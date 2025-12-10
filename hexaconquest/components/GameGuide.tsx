
import React from 'react';
import { X, Shield, Crosshair, Bomb, Crown, Landmark, Zap, BookOpen } from 'lucide-react';

interface GameGuideProps {
    mode: 'intro' | 'full';
    onClose: () => void;
    onStart?: () => void;
}

const GameGuide: React.FC<GameGuideProps> = ({ mode, onClose, onStart }) => {
    const isIntro = mode === 'intro';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className={`bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] ${isIntro ? 'max-w-md' : 'max-w-2xl w-full'}`}>

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-slate-700 bg-slate-900/50 rounded-t-2xl">
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                        {isIntro ? (
                            <>
                                <Crown size={24} className="text-yellow-400" />
                                <span>Hexa-warsへようこそ</span>
                            </>
                        ) : (
                            <>
                                <BookOpen size={24} className="text-blue-400" />
                                <span>ゲームルール説明</span>
                            </>
                        )}
                    </h2>
                    {!isIntro && (
                        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                            <X size={24} />
                        </button>
                    )}
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 text-slate-200 leading-relaxed space-y-6">

                    {isIntro ? (
                        // Intro Content
                        <div className="space-y-6 text-center">
                            <p className="text-slate-300">
                                6つの勢力が覇権を争う<br />
                                戦略的六角形陣取りゲームへようこそ。
                            </p>

                            <div className="grid grid-cols-1 gap-4 text-left bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                                <div className="flex items-start gap-3">
                                    <Zap className="text-yellow-400 shrink-0 mt-0.5" size={20} />
                                    <div className="text-sm">
                                        <strong className="block text-white mb-1">APを貯める</strong>
                                        ルーレットを回して行動ポイントを獲得
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Shield className="text-blue-400 shrink-0 mt-0.5" size={20} />
                                    <div className="text-sm">
                                        <strong className="block text-white mb-1">領土を拡大</strong>
                                        APを使って移動・攻撃・建築
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Crown className="text-red-400 shrink-0 mt-0.5" size={20} />
                                    <div className="text-sm">
                                        <strong className="block text-white mb-1">敵を殲滅</strong>
                                        敵の本拠地「要塞」を破壊して一発逆転！
                                    </div>
                                </div>
                            </div>

                            <p className="text-sm text-slate-400">
                                最後の勝者を目指して戦い抜きましょう。
                            </p>
                        </div>
                    ) : (
                        // Full Rules Content
                        <>
                            <section>
                                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2 border-b border-slate-700 pb-2">
                                    <Crown size={20} className="text-yellow-400" />
                                    勝利条件
                                </h3>
                                <p className="text-sm text-slate-300 ml-2">
                                    敵対するプレイヤーを全て倒し、<strong>最後の一人になる</strong>こと。<br />
                                    または、これ以上ゲームが進行できなくなった時点で<strong>最もスコア（領土数）が高い</strong>プレイヤーが勝利します。
                                </p>
                            </section>

                            <section>
                                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2 border-b border-slate-700 pb-2">
                                    <Zap size={20} className="text-blue-400" />
                                    ゲームの流れ
                                </h3>
                                <ol className="list-decimal list-inside text-sm text-slate-300 space-y-2 ml-2">
                                    <li>
                                        <strong className="text-white">ルーレットフェーズ:</strong><br />
                                        ルーレットを回してAP（行動ポイント）を獲得します。「銀行」を持っているとボーナスAPがもらえます。
                                    </li>
                                    <li>
                                        <strong className="text-white">アクションフェーズ:</strong><br />
                                        獲得したAPを消費して、領土の拡大、敵への攻撃、防衛設備の建築を行います。余ったAPは次のターンに持ち越せます。
                                    </li>
                                    <li>
                                        <strong className="text-white">ターン終了:</strong><br />
                                        アクションを終えたらターンを終了し、次のプレイヤーへ移ります。
                                    </li>
                                </ol>
                            </section>

                            <section>
                                <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">特殊タイルと建造物</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <TileCard icon={Crown} color="text-yellow-400" title="要塞 (Citadel)" desc="プレイヤーの本拠地。HP5。破壊されると即座に敗北し、全領土が破壊者に奪われます。APを使って修復や砲台の増設が可能です。" />
                                    <TileCard icon={Landmark} color="text-yellow-400" title="銀行 (Bank)" desc="所有していると、ターン開始時にボーナスAPを獲得できます。戦略的に重要な拠点です。" />
                                    <TileCard icon={Shield} color="text-blue-400" title="壁 (Wall)" desc="防御力が高い障害物です。占領するには通常の倍以上のAPが必要です。" />
                                    <TileCard icon={Crosshair} color="text-red-400" title="砲台 (Turret)" desc="ターン終了時、周囲の敵タイルを自動で攻撃・破壊します。" />
                                    <TileCard icon={Bomb} color="text-orange-400" title="地雷 (Mine)" desc="見えない罠です。敵が踏むと爆発し、そのプレイヤーの残りAPが全て0になります。" />
                                    <TileCard icon={Zap} color="text-cyan-400" title="ワープ (Warp)" desc="同じ色のワープゾーン同士は繋がっています。離れた場所へ瞬時に領土を広げる足掛かりになります。" />
                                </div>
                            </section>
                        </>
                    )}

                </div>

                {/* Footer */}
                {isIntro && onStart && (
                    <div className="p-6 border-t border-slate-700 bg-slate-800/50 rounded-b-2xl">
                        <button
                            onClick={onStart}
                            className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black text-xl rounded-xl shadow-lg hover:shadow-blue-500/25 transition-all active:scale-95"
                        >
                            ゲームスタート
                        </button>
                    </div>
                )}
                {!isIntro && (
                    <div className="p-4 border-t border-slate-700 bg-slate-800/50 rounded-b-2xl flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors"
                        >
                            閉じる
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const TileCard = ({ icon: Icon, color, title, desc }: any) => (
    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 flex gap-3">
        <div className={`mt-1 ${color} shrink-0`}>
            <Icon size={20} />
        </div>
        <div>
            <div className={`font-bold text-sm ${color}`}>{title}</div>
            <div className="text-xs text-slate-400 leading-tight mt-1">{desc}</div>
        </div>
    </div>
);

export default GameGuide;
