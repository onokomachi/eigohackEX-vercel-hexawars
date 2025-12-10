import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, Timestamp, query, where, getDocs, orderBy, writeBatch, deleteDoc } from 'firebase/firestore';
import {
    UserInfo, Stats, GameResult, IncorrectQuestion,
    MasteryData, MissionState, Question, PlayLogEntry, RankingEntry, AppSettings, ChallengeEntry, FilterableCategory, ChallengePeerInfo
} from '../types';
import * as storageService from './storageService';

const USERS_COLLECTION = 'users'; // Existing: Detailed user data
const PLAYLOGS_COLLECTION = 'playLogs'; // New: Flattens logs for easy querying
const RANKINGS_COLLECTION = 'rankings'; // New: Dedicated ranking collection
const APP_SETTINGS_COLLECTION = 'config'; // New: App settings
const CHALLENGES_COLLECTION = 'challenges'; // New: Challenges

// Helper to get user ref
const getUserRef = (userId: string) => doc(db, USERS_COLLECTION, userId);

export const syncLocalDataToFirestore = async (userInfo: UserInfo): Promise<void> => {
    if (!userInfo.studentId) return;

    // Generate a unique ID for the user based on their info
    // Format: grade-class-number (e.g., "2-1-15")
    const userId = `${userInfo.grade}-${userInfo.class}-${userInfo.studentId}`;
    const userRef = getUserRef(userId);

    try {
        const userDoc = await getDoc(userRef);

        // If user document doesn't exist, create it with local data
        if (!userDoc.exists()) {
            console.log('Syncing local data to Firestore for new user:', userId);

            const stats = storageService.getStats();
            const mastery = storageService.getMasteryData();
            const missions = storageService.getMissionState();
            const incorrectQuestions = storageService.getIncorrectQuestions();

            await setDoc(userRef, {
                info: userInfo,
                stats: stats,
                mastery: mastery,
                missions: missions,
                incorrectQuestions: incorrectQuestions,
                createdAt: Timestamp.now(),
                lastLogin: Timestamp.now()
            });
        } else {
            // Update last login
            await updateDoc(userRef, {
                lastLogin: Timestamp.now()
            });
        }
    } catch (error) {
        console.error('Error syncing data to Firestore:', error);
        throw error;
    }
};

// --- User Info & Stats ---
export const getStats = async (userId: string): Promise<Stats | null> => {
    try {
        const userDoc = await getDoc(getUserRef(userId));
        if (userDoc.exists()) {
            const data = userDoc.data();
            return data.stats as Stats;
        }
        return null;
    } catch (error) {
        console.error('Error fetching stats from Firestore:', error);
        return null;
    }
};

export const saveStats = async (userId: string, stats: Stats): Promise<void> => {
    try {
        await updateDoc(getUserRef(userId), {
            stats: stats
        });
    } catch (error) {
        console.error('Error saving stats to Firestore:', error);
    }
};

// --- Game Results: The Central Hub for Data Saving ---
export const saveGameResult = async (
    userInfo: UserInfo,
    result: GameResult,
    newIncorrectQuestions: IncorrectQuestion[],
    questionsPlayed: Question[],
    gameMode: 'select' | 'input' | 'sort' | 'test',
    category: FilterableCategory
): Promise<void> => {
    const userId = `${userInfo.grade}-${userInfo.class}-${userInfo.studentId}`;
    const userRef = getUserRef(userId);

    try {
        // 1. Transaction-like update for User Stats
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) return;

        const data = userDoc.data();
        const currentStats = data.stats as Stats;
        let currentIncorrect = data.incorrectQuestions as IncorrectQuestion[] || [];

        // Update Stats
        currentStats.totalPlays += 1;
        currentStats.lifetimeScore += result.score;
        currentStats.totalCorrect += result.correctAnswers;
        currentStats.totalAnswered += result.totalQuestions;

        // Update Category Stats
        const incorrectIds = new Set(newIncorrectQuestions.map(q => q.id));
        questionsPlayed.forEach(question => {
            const cat = question.category;
            if (currentStats.categoryStats[cat]) {
                currentStats.categoryStats[cat].total += 1;
                if (!incorrectIds.has(question.id)) {
                    currentStats.categoryStats[cat].correct += 1;
                }
            }
        });

        // Update Incorrect Questions
        newIncorrectQuestions.forEach(q => {
            if (!currentIncorrect.some(existing => existing.id === q.id)) {
                currentIncorrect.push(q);
            }
        });

        // Save User Doc
        await updateDoc(userRef, {
            stats: currentStats,
            incorrectQuestions: currentIncorrect,
        });

        // 2. Add to PlayLogs Collection (Flattened for Analysis)
        const batch = writeBatch(db);

        // We log each question played for detailed analytics if needed, 
        // OR we can just log the summary.
        // The original GAS implementation logged each question.
        // To save writes, let's log the SUMMARY in 'playLogs' collection 
        // BUT for Teacher Analytics detailed heatmaps, we might need per-question data?
        // Let's stick to the current TeacherScreen logic which expects PlayLogEntry[]
        // PlayLogEntry has: questionId, isCorrect, timestamp, studentId...

        questionsPlayed.forEach(q => {
            const isCorrect = !incorrectIds.has(q.id);
            const logRef = doc(collection(db, PLAYLOGS_COLLECTION));
            batch.set(logRef, {
                timestamp: new Date().toISOString(), // Use raw string to match existing types
                grade: userInfo.grade,
                class: userInfo.class,
                studentId: userInfo.studentId,
                questionId: q.id,
                isCorrect: isCorrect,
                createdAt: Timestamp.now() // For sorting in Firestore
            });
        });

        await batch.commit();

        // 3. Update/Add to Rankings
        // We only keep the BEST score per Category + Mode per User
        if (category !== 'review' && category !== 'weakness' && category !== 'all') { // Only rank specific categories? Or all?
            // Actually, GAS implementation limits logic in App.tsx? 
            // Let's just save valid ranking entries.
            await updateRanking(userInfo, result.score, category, gameMode);
        }

    } catch (error) {
        console.error('Error saving game result to Firestore:', error);
    }
};

// --- Play Logs (Teacher) ---
export const getPlayLogs = async (criteria: { grade: string; class?: string; studentId?: string; startDate?: string; endDate?: string }): Promise<PlayLogEntry[]> => {
    try {
        let q = query(collection(db, PLAYLOGS_COLLECTION));

        if (criteria.grade) q = query(q, where('grade', '==', criteria.grade));
        if (criteria.class && criteria.class !== 'all') q = query(q, where('class', '==', criteria.class));
        if (criteria.studentId && criteria.studentId !== 'all') q = query(q, where('studentId', '==', criteria.studentId));

        // Note: Firestore requires composite indexes for range queries mixed with equality.
        // For now, let's fetch by equality and filter date client-side if needed, 
        // OR ensure indexes are created.
        // Given the scale, server-side filtering is better.
        // If index is missing, it will throw an error with a link to create it.
        if (criteria.startDate) {
            // String comparison works for ISO dates
            q = query(q, where('timestamp', '>=', criteria.startDate));
        }
        if (criteria.endDate) {
            const endDateObj = new Date(criteria.endDate);
            endDateObj.setHours(23, 59, 59, 999);
            q = query(q, where('timestamp', '<=', endDateObj.toISOString()));
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => {
            const data = d.data();
            return {
                timestamp: data.timestamp,
                grade: data.grade,
                class: data.class,
                studentId: data.studentId,
                questionId: data.questionId,
                isCorrect: data.isCorrect
            } as PlayLogEntry;
        });
    } catch (error) {
        console.error('Error getting play logs:', error);
        return [];
    }
};

export const resetPlayLogs = async (criteria: { grade: string; class?: string | 'all'; studentId?: string | 'all' }): Promise<void> => {
    try {
        let q = query(collection(db, PLAYLOGS_COLLECTION));
        if (criteria.grade) q = query(q, where('grade', '==', criteria.grade));
        if (criteria.class && criteria.class !== 'all') q = query(q, where('class', '==', criteria.class));
        if (criteria.studentId && criteria.studentId !== 'all') q = query(q, where('studentId', '==', criteria.studentId));

        const snapshot = await getDocs(q);

        // Batch delete (limit 500 per batch)
        const chunks = [];
        let currentChunk = writeBatch(db);
        let count = 0;

        snapshot.docs.forEach((doc) => {
            currentChunk.delete(doc.ref);
            count++;
            if (count >= 490) {
                chunks.push(currentChunk);
                currentChunk = writeBatch(db);
                count = 0;
            }
        });
        if (count > 0) chunks.push(currentChunk);

        await Promise.all(chunks.map(chunk => chunk.commit()));
        console.log(`Deleted ${snapshot.size} logs.`);

    } catch (error) {
        console.error('Error resetting play logs:', error);
        throw error;
    }
}

// --- Rankings ---
export const updateRanking = async (userInfo: UserInfo, score: number, category: FilterableCategory, mode: 'select' | 'input' | 'sort' | 'test'): Promise<void> => {
    // Ranking ID composite: grade-class-number-category-mode
    const userId = `${userInfo.grade}-${userInfo.class}-${userInfo.studentId}`;
    const rankingId = `${userId}-${category}-${mode}`;
    const rankingRef = doc(db, RANKINGS_COLLECTION, rankingId);

    try {
        const docSnap = await getDoc(rankingRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (score > data.score) {
                await updateDoc(rankingRef, {
                    score: score,
                    timestamp: new Date().toISOString(),
                    updatedAt: Timestamp.now()
                });
            }
        } else {
            await setDoc(rankingRef, {
                name: `${userInfo.studentId}番 (Lv.${storageService.getStats().level})`, // Store snapshot of name/level
                grade: userInfo.grade,
                class: userInfo.class,
                studentId: userInfo.studentId,
                category,
                mode,
                score,
                timestamp: new Date().toISOString(),
                updatedAt: Timestamp.now()
            });
        }
    } catch (error) {
        console.error('Error updating ranking:', error);
    }
}

export const getRanking = async (filters: { grade: string | 'all'; class: string | 'all'; category: string | 'all'; mode: string | 'all' }): Promise<RankingEntry[]> => {
    try {
        let q = query(collection(db, RANKINGS_COLLECTION));

        if (filters.grade !== 'all') q = query(q, where('grade', '==', filters.grade));
        if (filters.class !== 'all') q = query(q, where('class', '==', filters.class));
        if (filters.category !== 'all') q = query(q, where('category', '==', filters.category));
        if (filters.mode !== 'all') q = query(q, where('mode', '==', filters.mode));

        // orderBy score desc
        q = query(q, orderBy('score', 'desc'));

        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => {
            const data = d.data();
            return {
                timestamp: data.timestamp,
                name: data.name,
                score: data.score,
                grade: data.grade,
                class: data.class,
                studentId: data.studentId,
                category: data.category,
                mode: data.mode
            } as RankingEntry;
        });

    } catch (error) {
        // Index might be missing for specific filter combos
        console.error('Error getting ranking:', error);
        return [];
    }
}

export const resetRanking = async (category: string | 'all' | 'weakness'): Promise<void> => {
    try {
        let q = query(collection(db, RANKINGS_COLLECTION));
        if (category !== 'all') {
            q = query(q, where('category', '==', category));
        }

        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();

    } catch (error) {
        console.error('Error resetting ranking:', error);
        throw error;
    }
}

// --- App Settings ---
export const getAppSettings = async (): Promise<AppSettings> => {
    try {
        const docRef = doc(db, APP_SETTINGS_COLLECTION, 'general');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as AppSettings;
        }
        // Default settings
        return { showLogoutButton: false, showResetButton: false };
    } catch (error) {
        console.error('Error getting app settings:', error);
        return { showLogoutButton: false, showResetButton: false };
    }
};

export const updateAppSettings = async (settings: AppSettings): Promise<void> => {
    try {
        const docRef = doc(db, APP_SETTINGS_COLLECTION, 'general');
        await setDoc(docRef, settings);
    } catch (error) {
        console.error('Error updating app settings:', error);
        throw error;
    }
};

// --- Challenges ---
export const getChallenges = async (userInfo: UserInfo): Promise<ChallengeEntry[]> => {
    const userId = `${userInfo.grade}-${userInfo.class}-${userInfo.studentId}`;
    try {
        const q = query(collection(db, CHALLENGES_COLLECTION), where('opponent.studentId', '==', userInfo.studentId), where('opponent.grade', '==', userInfo.grade), where('opponent.class', '==', userInfo.class));
        // Also could filter by status? 
        const snapshot = await getDocs(q);

        // Filter locally or better query depending on structure
        return snapshot.docs.map(d => ({ ...d.data(), challengeId: d.id } as ChallengeEntry));
    } catch (error) {
        console.error('Error fetching challenges:', error);
        return [];
    }
};

export const updateChallengeStatus = async (challengeId: string, status: 'accepted' | 'declined' | 'completed', resultScore?: number): Promise<void> => {
    try {
        const ref = doc(db, CHALLENGES_COLLECTION, challengeId);
        const updateData: any = { status };
        if (resultScore !== undefined) updateData.resultScore = resultScore;

        if (status === 'declined' || status === 'completed') {
            // Maybe delete it? Or keep it?
            // GAS version deleted declined ones?
            await updateDoc(ref, updateData);
            // If completed, maybe notify challenger? (Not implemented in GAS version fully)
            if (status === 'completed' || status === 'declined') {
                await deleteDoc(ref); // Clean up
            }
        } else {
            await updateDoc(ref, updateData);
        }
    } catch (error) {
        console.error('Error updating challenge:', error);
    }
}

export const createChallenge = async (
    challengerInfo: UserInfo,
    challengerName: string,
    opponentInfo: ChallengePeerInfo,
    category: FilterableCategory,
    mode: 'select' | 'input' | 'sort' | 'test',
    targetScore: number,
    questionIds: number[]
): Promise<void> => {
    try {
        const challengesRef = collection(db, CHALLENGES_COLLECTION);
        await addDoc(challengesRef, {
            challenger: { ...challengerInfo, name: challengerName },
            opponent: opponentInfo,
            category,
            mode,
            targetScore,
            questionIds,
            status: 'pending',
            challengerTimestamp: new Date().toISOString(),
            createdAt: Timestamp.now()
        });
    } catch (error) {
        console.error('Error creating challenge:', error);
        throw error;
    }
}

// --- Mastery & Missions Helpers (Keep Existing) ---
export const getMasteryData = async (userId: string): Promise<MasteryData | null> => {
    try {
        const userDoc = await getDoc(getUserRef(userId));
        if (userDoc.exists()) return userDoc.data().mastery as MasteryData;
        return null;
    } catch (error) { console.error(error); return null; }
};
export const saveMasteryData = async (userId: string, mastery: MasteryData): Promise<void> => {
    try { await updateDoc(getUserRef(userId), { mastery }); } catch (error) { console.error(error); }
};
export const getMissionState = async (userId: string): Promise<MissionState | null> => {
    try {
        const userDoc = await getDoc(getUserRef(userId));
        if (userDoc.exists()) return userDoc.data().missions as MissionState;
        return null;
    } catch (error) { console.error(error); return null; }
};
export const saveMissionState = async (userId: string, state: MissionState): Promise<void> => {
    try { await updateDoc(getUserRef(userId), { missions: state }); } catch (error) { console.error(error); }
};
export const getIncorrectQuestions = async (userId: string): Promise<IncorrectQuestion[]> => {
    try {
        const userDoc = await getDoc(getUserRef(userId));
        if (userDoc.exists()) return (userDoc.data().incorrectQuestions as IncorrectQuestion[]) || [];
        return [];
    } catch (error) { console.error(error); return []; }
};
export const updateIncorrectQuestions = async (userId: string, questions: IncorrectQuestion[]): Promise<void> => {
    try { await updateDoc(getUserRef(userId), { incorrectQuestions: questions }); } catch (error) { console.error(error); }
};
