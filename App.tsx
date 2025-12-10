

import React, { useState, useEffect, useCallback } from 'react';
import { type Screen, type GameMode, type Category, type Question, type GameResult, type IncorrectQuestion, type UserInfo, type PlayLogEntry, type ConfirmationState, type MissionState, type DailyMission, type FilterableCategory, type Stats, type ChallengeEntry, type ChallengePeerInfo, type AppSettings } from './types';
import * as storageService from './services/storageService';
import * as firestoreService from './services/firestoreService';
import { getQuestionsForCategory, getAllQuestions } from './data';
// import { GAS_WEB_APP_URL } from './constants';

import LoginScreen from './components/screens/LoginScreen';
import HomeScreen from './components/screens/HomeScreen';
import GameScreen from './components/screens/GameScreen';
import ResultsScreen from './components/screens/ResultsScreen';
import MyPageScreen from './components/screens/MyPageScreen';
import RankingScreen from './components/screens/RankingScreen';
import TeacherLoginScreen from './components/screens/TeacherLoginScreen';
import TeacherScreen from './components/screens/TeacherScreen';
import ConfirmationScreen from './components/screens/ConfirmationScreen';
import CyberPanel from './components/ui/CyberPanel';
import HexaconquestWrapper from './hexaconquest/HexaconquestWrapper';

const EXP_FOR_NEXT_LEVEL = (level: number) => 100 + (level - 1) * 50;

const App: React.FC = () => {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [screen, setScreen] = useState<Screen>('login');
  const [gameSettings, setGameSettings] = useState<{ mode: GameMode; category: FilterableCategory; questions: Question[] } | null>(null);
  const [lastResult, setLastResult] = useState<GameResult | null>(null);
  const [confirmationState, setConfirmationState] = useState<ConfirmationState | null>(null);
  const [lastPlayLogs, setLastPlayLogs] = useState<PlayLogEntry[]>([]);
  const [missionState, setMissionState] = useState<MissionState | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  // Popups
  const [showExpGain, setShowExpGain] = useState<{ description: string, exp: number }[] | null>(null);
  const [showLevelUp, setShowLevelUp] = useState<{ oldLevel: number, newLevel: number } | null>(null);

  // Challenge states
  const [challenges, setChallenges] = useState<ChallengeEntry[]>([]);
  const [isFetchingChallenges, setIsFetchingChallenges] = useState(false);
  const [activeChallenge, setActiveChallenge] = useState<ChallengeEntry | null>(null);
  const [showHexaconquest, setShowHexaconquest] = useState(false);
  const [currentCoins, setCurrentCoins] = useState(0);

  useEffect(() => {
    const savedUserInfo = storageService.getUserInfo();
    if (savedUserInfo) {
      handleLogin(savedUserInfo);
    }
  }, []);

  const fetchAppSettings = async () => {
    try {
      const settings = await firestoreService.getAppSettings();
      setAppSettings(settings);
    } catch (error) {
      console.error('Error fetching app settings:', error);
      setAppSettings({ showLogoutButton: false, showResetButton: false });
    }
  };

  const fetchChallenges = async (info: UserInfo) => {
    setIsFetchingChallenges(true);
    try {
      const challenges = await firestoreService.getChallenges(info);
      setChallenges(challenges);
    } catch (error) {
      console.error('Error fetching challenges:', error);
      setChallenges([]);
    } finally {
      setIsFetchingChallenges(false);
    }
  };

  const handleLogin = async (info: UserInfo) => {
    setUserInfo(info);
    storageService.saveUserInfo(info);

    // Sync to Firestore
    try {
      await firestoreService.syncLocalDataToFirestore(info);
      // Optionally load fresh data from Firestore here to ensure consistency
      const userId = `${info.grade}-${info.class}-${info.studentId}`;
      const remoteStats = await firestoreService.getStats(userId);
      if (remoteStats) {
        storageService.saveStats(remoteStats);
        setCurrentCoins(remoteStats.points);
      }
    } catch (error) {
      console.error("Login sync failed:", error);
    }

    initializeMissions();
    fetchChallenges(info);
    fetchAppSettings();
    setScreen('home');
  };

  const handleLogout = () => {
    setUserInfo(null);
    storageService.clearUserInfo();
    setChallenges([]);
    setAppSettings(null);
    setScreen('login');
  }

  const initializeMissions = () => {
    let currentMissions = storageService.getMissionState();
    const todayStr = new Date().toISOString().split('T')[0];
    if (!currentMissions || currentMissions.date !== todayStr) {
      const stats = storageService.getStats();
      currentMissions = generateDailyMissions(stats);
      storageService.saveMissionState(currentMissions);
    }
    setMissionState(currentMissions);
  };

  const generateDailyMissions = (stats: Stats): MissionState => {
    const allCategories = ['未来', '動名詞', '不定詞', '助動詞', '比較', 'there is', '接続詞', '受け身', '現在完了', '現在完了進行形', '不定詞2'] as Category[];
    const missions: DailyMission[] = [];

    const playedCategories = allCategories.filter(cat => stats.categoryStats[cat]?.total > 2);
    if (playedCategories.length > 0) {
      const weakCategory = playedCategories.sort((a, b) =>
        (stats.categoryStats[a].correct / stats.categoryStats[a].total) -
        (stats.categoryStats[b].correct / stats.categoryStats[b].total)
      )[0];
      missions.push({
        id: 'cat_1', type: 'solve_category', description: `「${weakCategory}」の問題を5問正解しよう`,
        target: 5, progress: 0, completed: false, category: weakCategory, expReward: 75
      });
    } else {
      missions.push({
        id: 'cat_generic_1', type: 'solve_category', description: `好きな分野の問題を10問正解しよう`,
        target: 10, progress: 0, completed: false, category: 'all', expReward: 50
      });
    }

    missions.push({
      id: 'rank_1', type: 'get_rank', description: `Bランク以上を1回取ろう`,
      target: 1, progress: 0, completed: false, rank: 'B', expReward: 100
    });

    missions.push({
      id: 'total_1', type: 'answer_total', description: '合計20問に解答しよう',
      target: 20, progress: 0, completed: false, expReward: 50
    });

    return {
      date: new Date().toISOString().split('T')[0],
      missions: missions.slice(0, 3).sort(() => Math.random() - 0.5),
    };
  };

  const startGame = useCallback((mode: GameMode, category: FilterableCategory, questionIds?: number[]) => {
    let questionsPool: Question[] = [];
    const allQuestions = getAllQuestions();

    if (questionIds) {
      const questionMap = new Map(allQuestions.map(q => [q.id, q]));
      questionsPool = questionIds.map(id => questionMap.get(id)).filter((q): q is Question => !!q);
    } else if (category === 'review') {
      const masteryData = storageService.getMasteryData();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const reviewIds = Object.keys(masteryData)
        .filter(id => {
          const entry = masteryData[Number(id)];
          return entry.level !== 'mastered' && new Date(entry.nextReviewDate) <= today;
        })
        .map(Number);

      questionsPool = allQuestions.filter(q => reviewIds.includes(q.id));
      if (questionsPool.length === 0) {
        alert('本日の復習問題はありません。素晴らしい！');
        return;
      }
    } else if (category === 'weakness') {
      const incorrect = storageService.getIncorrectQuestions();
      const incorrectIds = new Set(incorrect.map(q => q.id));
      questionsPool = allQuestions.filter(q => incorrectIds.has(q.id));
    } else if (category === 'all') {
      questionsPool = allQuestions;
    } else {
      questionsPool = getQuestionsForCategory(category);
    }

    let filteredQuestions: Question[];
    if (mode === 'select' || mode === 'input' || mode === 'sort') {
      filteredQuestions = questionsPool.filter(q => q.type === mode);
    } else {
      filteredQuestions = questionsPool;
    }

    const selectedQuestions = questionIds ? filteredQuestions : filteredQuestions.sort(() => 0.5 - Math.random()).slice(0, 20);

    if (selectedQuestions.length > 0) {
      setGameSettings({ mode, category, questions: selectedQuestions });
      setScreen('game');
    } else {
      alert('このカテゴリまたはモードには問題がありません。');
    }
  }, []);

  const handleAcceptChallenge = (challenge: ChallengeEntry) => {
    setActiveChallenge(challenge);
    startGame(challenge.mode, challenge.category, challenge.questionIds);
  };

  const handleDeclineChallenge = async (challengeId: string) => {
    setChallenges(prev => prev.filter(c => c.challengeId !== challengeId));
    try {
      await firestoreService.updateChallengeStatus(challengeId, 'declined');
    } catch (error) {
      console.error('Failed to decline challenge:', error);
    }
  };

  const handleMissionUpdatesAndExp = (result: GameResult, settings: typeof gameSettings) => {
    const currentMissionState = storageService.getMissionState();
    if (!currentMissionState) return;

    const currentStats = storageService.getStats();
    let totalExpGained = 0;
    const newlyCompletedMissions: { description: string, exp: number }[] = [];

    const updatedMissions = currentMissionState.missions.map(mission => {
      if (mission.completed) return mission;

      let progressIncrement = 0;
      switch (mission.type) {
        case 'answer_total':
          progressIncrement = result.totalQuestions;
          break;
        case 'solve_category':
          const isRankableCategory = settings?.category !== 'weakness' && settings?.category !== 'review';
          if (isRankableCategory && (mission.category === 'all' || mission.category === settings?.category)) {
            progressIncrement = result.correctAnswers;
          }
          break;
        case 'get_rank':
          if (mission.rank && result.rank.charCodeAt(0) <= mission.rank.charCodeAt(0)) {
            progressIncrement = 1;
          }
          break;
        case 'perfect_game':
          if (result.correctAnswers === result.totalQuestions && result.totalQuestions > 0) {
            progressIncrement = 1;
          }
          break;
      }

      const newProgress = mission.progress + progressIncrement;
      const isCompleted = newProgress >= mission.target;

      if (isCompleted && !mission.completed) {
        totalExpGained += mission.expReward;
        newlyCompletedMissions.push({ description: mission.description, exp: mission.expReward });
      }
      return { ...mission, progress: newProgress, completed: isCompleted };
    });

    if (newlyCompletedMissions.length > 0) {
      setShowExpGain(newlyCompletedMissions);
    }

    const newMissionState = { ...currentMissionState, missions: updatedMissions };
    storageService.saveMissionState(newMissionState);
    setMissionState(newMissionState);

    if (userInfo) {
      const userId = `${userInfo.grade}-${userInfo.class}-${userInfo.studentId}`;
      firestoreService.saveMissionState(userId, newMissionState);
    }

    if (totalExpGained > 0) {
      const oldLevel = currentStats.level;
      let newExp = currentStats.exp + totalExpGained;
      let newLevel = currentStats.level;
      let expForNext = EXP_FOR_NEXT_LEVEL(newLevel);

      while (newExp >= expForNext) {
        newExp -= expForNext;
        newLevel++;
        expForNext = EXP_FOR_NEXT_LEVEL(newLevel);
      }

      const newStats: Stats = { ...currentStats, exp: newExp, level: newLevel };
      storageService.saveStats(newStats);

      if (newLevel > oldLevel) {
        setTimeout(() => {
          setShowExpGain(null);
          setShowLevelUp({ oldLevel, newLevel });
        }, newlyCompletedMissions.length > 0 ? 2500 : 500);
      }
    }
  };

  const deductCoins = (amount: number): boolean => {
    const currentStats = storageService.getStats();
    if (currentStats.points >= amount) {
      currentStats.points -= amount;
      storageService.saveStats(currentStats);
      setCurrentCoins(currentStats.points);

      // Firestore Update (Fire and Forget or Optimistic)
      if (userInfo) {
        const userId = `${userInfo.grade}-${userInfo.class}-${userInfo.studentId}`;
        firestoreService.saveStats(userId, currentStats);
      }

      // Force update stats in HomeScreen via event or state
      window.dispatchEvent(new Event('statsUpdated'));
      return true;
    }
    return false;
  };

  const endGame = useCallback(async (rawScore: number, correctAnswers: number, totalQuestions: number, incorrect: Question[], playedQuestions: Map<number, boolean>) => {
    if (!userInfo) return;

    const correctRate = totalQuestions > 0 ? correctAnswers / totalQuestions : 0;
    const finalScore = Math.round(rawScore * (correctRate ** 2));

    const rank = finalScore >= 320 ? 'S' : finalScore >= 240 ? 'A' : finalScore >= 150 ? 'B' : finalScore >= 75 ? 'C' : 'D';

    const comments = {
      S: '完璧です！正答率・スピードともに最高レベル！',
      A: '素晴らしい成績です！高い正答率を維持できています。',
      B: '良い調子です！この調子で正答率を上げていきましょう。',
      C: 'まずは基本をマスター！正答率を意識して再挑戦しよう。',
      D: 'まだ伸びしろあり！まずは正解することを目標に。'
    };

    const result: GameResult = {
      score: finalScore,
      correctAnswers,
      totalQuestions,
      rank,
      comment: comments[rank],
    };

    // Award Coins (50 per correct answer * Multiplier)
    // Weakness Mode: No Coins, No Score, No Ranking
    if (gameSettings && gameSettings.category !== 'weakness') {
      let coinMultiplier = 1;
      if (gameSettings.mode === 'sort') coinMultiplier = 2;
      if (gameSettings.mode === 'input') coinMultiplier = 4;

      const coinsEarned = correctAnswers * 50 * coinMultiplier;

      const currentStats = storageService.getStats();
      currentStats.points = (currentStats.points || 0) + coinsEarned;
      storageService.saveStats(currentStats);
      setCurrentCoins(currentStats.points);

      if (userInfo) {
        const userId = `${userInfo.grade}-${userInfo.class}-${userInfo.studentId}`;
        firestoreService.saveStats(userId, currentStats);
      }
    }

    window.dispatchEvent(new Event('statsUpdated'));

    const logEntries: PlayLogEntry[] = Array.from(playedQuestions.entries()).map(([questionId, isCorrect]) => ({
      timestamp: new Date().toISOString(),
      ...userInfo,
      questionId,
      isCorrect,
    }));

    setLastResult(result);
    setLastPlayLogs(logEntries);

    const incorrectForStorage: IncorrectQuestion[] = incorrect.map(q => ({ id: q.id, question: q.question, answer: q.answer }));

    if (gameSettings) {
      storageService.saveGameResult(result, incorrectForStorage, gameSettings.questions);

      if (userInfo) {
        const userId = `${userInfo.grade}-${userInfo.class}-${userInfo.studentId}`;
        // UPDATED: firestoreService.saveGameResult now requires more args and handles logic
        firestoreService.saveGameResult(
          userInfo,
          result,
          incorrectForStorage,
          gameSettings.questions,
          gameSettings.mode as any, // Cast or ensure type matches
          gameSettings.category
        );
      }

      handleMissionUpdatesAndExp(result, gameSettings);
    }

    if (activeChallenge) {
      try {
        await firestoreService.updateChallengeStatus(activeChallenge.challengeId, 'completed', finalScore);
        setChallenges(prev => prev.filter(c => c.challengeId !== activeChallenge.challengeId));
      } catch (error) {
        console.error('Failed to complete challenge:', error);
      }
      setActiveChallenge(null);
    }

    setScreen('results');
  }, [gameSettings, userInfo, activeChallenge]);

  const navigateTo = (newScreen: Screen) => {
    if (newScreen === 'home' && userInfo) {
      initializeMissions();
      fetchChallenges(userInfo);
    }
    setScreen(newScreen);
  };

  const requestConfirmation = (message: string, onConfirm: () => void) => {
    setConfirmationState({
      message,
      onConfirm: () => {
        setConfirmationState(null);
        onConfirm();
      },
      onCancel: () => {
        setConfirmationState(null);
      },
    });
  };

  const renderScreen = () => {
    const homeScreenComponent = <HomeScreen userInfo={userInfo} onStartGame={startGame} onNavigate={navigateTo} missionState={missionState} challenges={challenges} onAcceptChallenge={handleAcceptChallenge} onDeclineChallenge={handleDeclineChallenge} isFetchingChallenges={isFetchingChallenges} onLogout={handleLogout} requestConfirmation={requestConfirmation} appSettings={appSettings} onOpenHexaconquest={() => setShowHexaconquest(true)} />;

    if (showHexaconquest && userInfo) {
      return (
        <HexaconquestWrapper
          userInfo={userInfo}
          onBack={() => setShowHexaconquest(false)}
          deductCoins={deductCoins}
          currentCoins={currentCoins}
        />
      );
    }

    switch (screen) {
      case 'login':
        return <LoginScreen onLogin={handleLogin} onNavigate={navigateTo} />;
      case 'home':
        return homeScreenComponent;
      case 'game':
        if (gameSettings) {
          return <GameScreen settings={gameSettings} onEndGame={endGame} userInfo={userInfo} />;
        }
        return homeScreenComponent;
      case 'results':
        if (lastResult && userInfo) {
          return <ResultsScreen
            result={lastResult}
            onNavigate={navigateTo}
            onRestart={() => gameSettings && startGame(gameSettings.mode, gameSettings.category)}
            userInfo={userInfo}
            gameSettings={gameSettings}
            playLogs={lastPlayLogs}
          />;
        }
        return homeScreenComponent;
      case 'mypage':
        return <MyPageScreen onNavigate={navigateTo} requestConfirmation={requestConfirmation} appSettings={appSettings} />;
      case 'ranking':
        return <RankingScreen onNavigate={navigateTo} />;
      case 'teacher_login':
        return <TeacherLoginScreen onNavigate={navigateTo} />;
      case 'teacher_panel':
        return <TeacherScreen onNavigate={navigateTo} onLogout={handleLogout} requestConfirmation={requestConfirmation} />;
      default:
        return <LoginScreen onLogin={handleLogin} onNavigate={navigateTo} />;
    }
  };

  return (
    <>
      <style>{`
        @keyframes text-gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
      <div
        className="min-h-screen"
        style={{
          backgroundColor: '#0a0a0a',
          backgroundImage: `
          radial-gradient(circle at 20% 30%, rgba(139, 92, 246, 0.5), transparent 40%),
          radial-gradient(circle at 80% 70%, rgba(249, 115, 22, 0.5), transparent 40%),
          radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.3), transparent 50%),
          radial-gradient(circle at 90% 30%, rgba(249, 115, 22, 0.3), transparent 45%)
        `,
          backgroundSize: '200% 200%',
          animation: 'mist-drift 15s ease-in-out infinite',
          minHeight: '100vh',
        }}
      >
        <main className="container mx-auto p-4 max-w-4xl relative">
          {renderScreen()}
          {confirmationState && (
            <ConfirmationScreen
              message={confirmationState.message}
              onConfirm={confirmationState.onConfirm}
              onCancel={confirmationState.onCancel}
            />
          )}
          {showExpGain && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 fade-in" onClick={() => setShowExpGain(null)}>
              <CyberPanel className="text-center w-full max-w-md">
                <h2 className="text-2xl font-bold text-yellow-400 mb-4 glow-accent">ミッション達成！</h2>
                <ul className="text-lg text-gray-200 whitespace-pre-wrap mb-8 text-left space-y-2">
                  {showExpGain.map((item, i) => <li key={i}>・{item.description} <span className="font-bold text-green-400">(+{item.exp} EXP)</span></li>)}
                </ul>
                <button onClick={() => setShowExpGain(null)} className="px-6 py-2 bg-orange-600 text-white font-bold rounded-md hover:bg-orange-500 transition-colors">
                  閉じる
                </button>
              </CyberPanel>
            </div>
          )}
          {showLevelUp && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 fade-in" onClick={() => setShowLevelUp(null)}>
              <CyberPanel className="text-center w-full max-w-md border-green-400">
                <h2 className="text-4xl font-bold text-green-300 mb-4 glow-primary">LEVEL UP!</h2>
                <div className="text-6xl font-orbitron text-gray-200 flex items-center justify-center gap-4 mb-8">
                  <span>{showLevelUp.oldLevel}</span>
                  <span className="text-green-400">→</span>
                  <span>{showLevelUp.newLevel}</span>
                </div>
                <button onClick={() => setShowLevelUp(null)} className="px-6 py-2 bg-green-600 text-white font-bold rounded-md hover:bg-green-500 transition-colors">
                  OK
                </button>
              </CyberPanel>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default App;