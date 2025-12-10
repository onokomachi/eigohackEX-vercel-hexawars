
import React, { useState } from 'react';
import CyberPanel from '../ui/CyberPanel';
import TextGradient from '../ui/TextGradient';
import { type UserInfo, type Screen } from '../../types';

interface LoginScreenProps {
  onLogin: (userInfo: UserInfo) => void;
  onNavigate: (screen: Screen) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onNavigate }) => {
  const [grade, setGrade] = useState('2');
  const [className, setClassName] = useState('1');
  const [studentId, setStudentId] = useState('1');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (grade && className && studentId) {
      onLogin({ grade, class: className, studentId });
    } else {
      alert('すべての項目を選択してください。');
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen text-center p-4 fade-in">
      <h1 className="text-5xl md:text-6xl tracking-wider mb-2">
        <TextGradient text="英語HACK" />
      </h1>
      <div className="text-sm md:text-base font-bold text-purple-300 tracking-[0.2em] mb-8 neon-text-purple">
        【ver.Hexa-wars】
      </div>

      <div className="glass-panel w-full max-w-sm p-8 rounded-2xl border-orange-500/30 shadow-[0_0_20px_rgba(249,115,22,0.2)]">
        <h2 className="text-xl font-bold text-orange-100 mb-6 tracking-wide border-b border-orange-500/30 pb-2">USER LOGIN</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-lg text-orange-200 mb-2">学年</label>
            <select value={grade} onChange={e => setGrade(e.target.value)} className="w-full bg-slate-900/80 text-white p-3 rounded-lg border border-orange-500/50 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/50 outline-none transition-all">
              <option value="1">1年</option>
              <option value="2">2年</option>
              <option value="3">3年</option>
            </select>
          </div>
          <div>
            <label className="block text-lg text-orange-200 mb-2">クラス</label>
            <select value={className} onChange={e => setClassName(e.target.value)} className="w-full bg-slate-900/80 text-white p-3 rounded-lg border border-orange-500/50 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/50 outline-none transition-all">
              {['1', '2', '3', '4', '5', '6'].map(c => <option key={c} value={c}>{c}組</option>)}
            </select>
          </div>
          <div>
            <label className="block text-lg text-orange-200 mb-2">番号</label>
            <select value={studentId} onChange={e => setStudentId(e.target.value)} className="w-full bg-slate-900/80 text-white p-3 rounded-lg border border-orange-500/50 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/50 outline-none transition-all">
              {Array.from({ length: 40 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}番</option>)}
            </select>
          </div>
          <button type="submit" className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white font-bold text-xl py-4 mt-6 rounded-xl hover:brightness-110 transition-all duration-300 shadow-[0_0_15px_rgba(249,115,22,0.5)] clip-hex-button">
            学習をはじめる
          </button>
        </form>
      </div>

      <div className="absolute top-4 right-4">
        <button onClick={() => onNavigate('teacher_login')} className="text-sm text-orange-400 hover:underline">先生用</button>
      </div>

      <div className="absolute bottom-4 right-4 text-xs text-gray-500">
        presented by onokomachi
      </div>
    </div>
  );
};

export default LoginScreen;
