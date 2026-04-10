"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, X, User, Clock, Trophy, Heart, Target, ThumbsUp, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

// Constants
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 600;
const PADDLE_WIDTH = 100;
const PADDLE_HEIGHT = 12;
const BALL_RADIUS = 7;
const BRICK_ROWS = 5;
const BRICK_COLS = 8;
const BRICK_PADDING = 8;
const BRICK_OFFSET_TOP = 70;
const REAL_BRICK_WIDTH = 62;
const REAL_BRICK_OFFSET_LEFT = 24;

const BALL_SPEED = 5.8; 
const PADDLE_SPEED = 8.5; 
const PADDLE_Y = CANVAS_HEIGHT - PADDLE_HEIGHT - 10;

const COLORS = [
  { fill: "#ff8a80", stroke: "#e53935" },
  { fill: "#ffb74d", stroke: "#fb8c00" },
  { fill: "#fff176", stroke: "#fbc02d" },
  { fill: "#81d4fa", stroke: "#039be5" },
  { fill: "#a5d6a7", stroke: "#43a047" },
  { fill: "#ce93d8", stroke: "#8e24aa" },
];

const BTN_BASE = "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors outline-offset-2 disabled:pointer-events-none disabled:opacity-50";
const BTN_DEFAULT = "bg-blue-600 text-white shadow-sm hover:bg-blue-600/90";
const BTN_OUTLINE = "border border-zinc-200 bg-white/50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:bg-zinc-800";
const BTN_DESTRUCTIVE = "bg-rose-50 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950/30";
const BTN_SIZE_ICON = "h-9 w-9";

type GameState = "START" | "COUNTDOWN" | "PLAYING" | "PAUSED" | "WON" | "GAME_OVER";

interface Brick { x: number; y: number; status: number; color: string; isRed: boolean; }
interface LeaderboardRecord { name: string; finishtime: string; }

export default function BreakoutGame() {
  const [gameState, setGameState] = useState<GameState>("START");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [time, setTime] = useState(0);
  const [lives, setLives] = useState(3);
  const [redBricksBroken, setRedBricksBroken] = useState(0);
  const [finalTime, setFinalTime] = useState("");
  const [showThumbsUp, setShowThumbsUp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [topRecords, setTopRecords] = useState<LeaderboardRecord[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [revealLeaderboard, setRevealLeaderboard] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hitSoundRef = useRef<HTMLAudioElement | null>(null);
  const missSoundRef = useRef<HTMLAudioElement | null>(null);
  const hasSavedResultRef = useRef(false);
  
  const paddleRef = useRef({ x: (CANVAS_WIDTH - PADDLE_WIDTH) / 2 });
  const ballRef = useRef({ x: CANVAS_WIDTH / 2, y: PADDLE_Y - BALL_RADIUS, dx: 3.5, dy: -3.5 });
  const bricksRef = useRef<Brick[]>([]);
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    audioRef.current = new Audio("/Hyper_Speed_Run.mp3");
    audioRef.current.loop = true; audioRef.current.volume = 0.15;
    hitSoundRef.current = new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YTtvT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19");
    missSoundRef.current = new Audio("data:audio/wav;base64,UklGRmRvT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YT9vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19vT19");
    return () => { audioRef.current?.pause(); audioRef.current = null; };
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    if (gameState === "COUNTDOWN" || gameState === "PLAYING") {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
      if (gameState === "START") audioRef.current.currentTime = 0;
    }
  }, [gameState]);

  const fetchTopRecords = async () => {
    setIsLoadingLeaderboard(true);
    try {
      const resp = await fetch("/api/record");
      if (resp.ok) {
        const data = await resp.json();
        setTopRecords(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      setTopRecords([]);
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  const saveResult = async (name: string, ftime: string) => {
    if (hasSavedResultRef.current) return;
    hasSavedResultRef.current = true;
    setIsSaving(true);
    try {
      await fetch("/api/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, finishtime: ftime }),
      });
      await fetchTopRecords();
      setTimeout(() => setRevealLeaderboard(true), 1200);
    } catch (e) {
      hasSavedResultRef.current = false; 
    } finally {
      setIsSaving(false);
    }
  };

  const initBricks = useCallback(() => {
    const newBricks: Brick[] = [];
    for (let c = 0; c < BRICK_COLS; c++) {
      for (let r = 0; r < BRICK_ROWS; r++) {
        const isRed = Math.random() < 0.3;
        const color = isRed ? COLORS[0] : COLORS[Math.floor(Math.random() * (COLORS.length - 1)) + 1];
        newBricks.push({ 
          x: c * (REAL_BRICK_WIDTH + BRICK_PADDING) + REAL_BRICK_OFFSET_LEFT, 
          y: r * (22 + BRICK_PADDING) + BRICK_OFFSET_TOP, 
          status: 1, color: color.fill, isRed 
        });
      }
    }
    bricksRef.current = newBricks;
  }, []);

  useEffect(() => {
    let t: NodeJS.Timeout;
    if (gameState === "PLAYING") t = setInterval(() => setTime(v => v + 1), 1000);
    return () => clearInterval(t);
  }, [gameState]);

  useEffect(() => {
    if (gameState === "COUNTDOWN" && countdown !== null) {
      if (countdown > 0) setTimeout(() => setCountdown(countdown - 1), 1000);
      else { setGameState("PLAYING"); setCountdown(null); }
    }
  }, [gameState, countdown]);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  useEffect(() => {
    const down = (e: KeyboardEvent) => { keysPressed.current[e.key] = true; };
    const up = (e: KeyboardEvent) => { keysPressed.current[e.key] = false; };
    window.addEventListener("keydown", down, { passive: true });
    window.addEventListener("keyup", up, { passive: true });
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const handleTouch = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (gameState !== "PLAYING" && gameState !== "COUNTDOWN") return;
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const canvasX = ((x - rect.left) / rect.width) * CANVAS_WIDTH;
    paddleRef.current.x = Math.max(0, Math.min(CANVAS_WIDTH - PADDLE_WIDTH, canvasX - PADDLE_WIDTH / 2));
  }, [gameState]);

  // Moved 'draw' before 'update' to fix ReferenceError
  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    bricksRef.current.forEach(b => { if (b.status === 1) { ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, REAL_BRICK_WIDTH, 22); } });
    ctx.fillStyle = "#3b82f6"; ctx.beginPath(); ctx.roundRect(paddleRef.current.x, PADDLE_Y, PADDLE_WIDTH, PADDLE_HEIGHT, 6); ctx.fill();
    ctx.fillStyle = "#f87171"; ctx.beginPath(); ctx.arc(ballRef.current.x, ballRef.current.y, BALL_RADIUS, 0, Math.PI * 2); ctx.fill();
  }, []);

  const update = useCallback((currentTime: number) => {
    if (gameState === "COUNTDOWN") { draw(); requestRef.current = requestAnimationFrame(update); return; }
    if (gameState !== "PLAYING") { lastTimeRef.current = 0; return; }
    if (!lastTimeRef.current) { lastTimeRef.current = currentTime; requestRef.current = requestAnimationFrame(update); return; }
    const dt = Math.min((currentTime - lastTimeRef.current) / 16.66, 2.0);
    lastTimeRef.current = currentTime;
    const ball = ballRef.current; const paddle = paddleRef.current;
    if (keysPressed.current["ArrowRight"]) paddle.x = Math.min(CANVAS_WIDTH - PADDLE_WIDTH, paddle.x + PADDLE_SPEED * dt);
    if (keysPressed.current["ArrowLeft"]) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    ball.x += ball.dx * dt; ball.y += ball.dy * dt;
    if (ball.x > CANVAS_WIDTH - BALL_RADIUS || ball.x < BALL_RADIUS) ball.dx = -ball.dx;
    if (ball.y < BALL_RADIUS) ball.dy = -ball.dy;
    else if (ball.y + BALL_RADIUS > PADDLE_Y && ball.y - ball.dy * dt + BALL_RADIUS <= PADDLE_Y) {
      if (ball.x > paddle.x && ball.x < paddle.x + PADDLE_WIDTH) {
        const hp = (ball.x - (paddle.x + PADDLE_WIDTH / 2)) / (PADDLE_WIDTH / 2);
        const ang = hp * (Math.PI / 3);
        ball.dx = BALL_SPEED * Math.sin(ang); ball.dy = -BALL_SPEED * Math.cos(ang);
        ball.y = PADDLE_Y - BALL_RADIUS;
      }
    } else if (ball.y > CANVAS_HEIGHT + BALL_RADIUS) {
      if (missSoundRef.current) { const s = missSoundRef.current.cloneNode() as HTMLAudioElement; s.volume = 0.4; s.play(); }
      setLives(v => {
        if (v <= 1) { setGameState("GAME_OVER"); return 0; }
        ballRef.current = { x: paddle.x + PADDLE_WIDTH/2, y: PADDLE_Y - BALL_RADIUS - 5, dx: 0, dy: -BALL_SPEED };
        return v - 1;
      });
    }
    for (let b of bricksRef.current) {
      if (b.status === 1) {
        const cx = Math.max(b.x, Math.min(ball.x, b.x + REAL_BRICK_WIDTH)), cy = Math.max(b.y, Math.min(ball.y, b.y + 22));
        const dx = ball.x - cx, dy = ball.y - cy;
        if ((dx * dx + dy * dy) < (BALL_RADIUS * BALL_RADIUS)) {
          if (Math.abs(dx) < Math.abs(dy)) ball.dy = -ball.dy; else ball.dx = -ball.dx;
          b.status = 0; if (hitSoundRef.current) { const s = hitSoundRef.current.cloneNode() as HTMLAudioElement; s.volume = 0.3; s.play(); }
          if (b.isRed) { if (redBricksBroken < 2) { setShowThumbsUp(true); setTimeout(() => setShowThumbsUp(false), 800); } setRedBricksBroken(v => v + 1); }
          break;
        }
      }
    }
    draw(); requestRef.current = requestAnimationFrame(update);
  }, [gameState, redBricksBroken, draw]);

  useEffect(() => {
    if (redBricksBroken >= 3 && gameState === "PLAYING") {
      setGameState("WON"); const f = formatTime(time); setFinalTime(f);
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      saveResult(playerName, f);
    }
  }, [redBricksBroken, gameState, time, playerName]);


  useEffect(() => {
    if (gameState === "PLAYING" || gameState === "COUNTDOWN") requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState, update]);

  const startGame = () => {
    if (!playerName.trim()) return;
    initBricks(); setLives(3); setGameState("COUNTDOWN"); setCountdown(3); setTime(0); setRedBricksBroken(0); setRevealLeaderboard(false);
    ballRef.current = { x: CANVAS_WIDTH / 2, y: PADDLE_Y - BALL_RADIUS - 5, dx: 3.5, dy: -BALL_SPEED };
    hasSavedResultRef.current = false; setTopRecords([]); fetchTopRecords(); 
  };

  const cleanTime = (t: string) => {
    if (t.includes(":") && t.length > 8) { 
      const match = t.match(/\d{2}:\d{2}:\d{2}/);
      if (match) return match[0].substring(0, 5); 
    }
    return t.substring(0, 5); 
  };

  return (
    <div className="relative flex flex-col h-[100vh] items-center justify-center bg-zinc-50 dark:bg-zinc-950 transition-colors duration-500 overflow-hidden select-none touch-none">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[100px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[100px] rounded-full"></div>
      </div>

      <div className="relative z-10 w-full max-w-[640px] bg-white dark:bg-zinc-900 shadow-2xl rounded-[2.5rem] overflow-hidden border border-zinc-200 dark:border-zinc-800 backdrop-blur-3xl mx-4">
        {(gameState === "PLAYING" || gameState === "PAUSED" || gameState === "COUNTDOWN") && (
          <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Lives</span>
                <div className="flex items-center gap-0.5 mt-0.5">
                  {[...Array(3)].map((_, i) => (
                    <Heart key={i} size={14} className={i < lives ? "text-rose-500 fill-rose-500" : "text-zinc-200 dark:text-zinc-700"} />
                  ))}
                </div>
              </div>
              <div className="flex flex-col"><span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Player</span><span className="text-sm font-bold flex items-center gap-1">{playerName}</span></div>
              <div className="flex flex-col"><span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Time</span><span className="text-sm font-mono font-bold text-rose-500">{formatTime(time)}</span></div>
              <div className="flex flex-col"><span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Target</span><span className="text-sm font-bold flex items-center gap-1 text-emerald-500"><Target size={14} className="inline mr-1" /> {redBricksBroken}/3</span></div>
            </div>
            <div className="flex items-center gap-2">
              <button disabled={gameState === "COUNTDOWN"} onClick={() => setGameState(v => v === "PLAYING" ? "PAUSED" : "PLAYING")} className={`${BTN_BASE} ${BTN_OUTLINE} ${BTN_SIZE_ICON}`}>{gameState === "PLAYING" ? <Pause size={18} /> : <Play size={18} />}</button>
              <button onClick={() => setGameState("START")} className={`${BTN_BASE} ${BTN_DESTRUCTIVE} ${BTN_SIZE_ICON} border-none shadow-none focus:ring-0`}><X size={18} /></button>
            </div>
          </div>
        )}

        <div className="relative aspect-square w-full flex items-center justify-center bg-white dark:bg-zinc-950/20 py-4">
          <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="max-w-full h-auto cursor-none" onTouchStart={handleTouch} onTouchMove={handleTouch} onMouseMove={handleTouch} />
          <AnimatePresence mode="wait">
            {showThumbsUp && (<motion.div key="tu" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1.2 }} exit={{ opacity: 0, scale: 1.5 }} className="absolute z-30 pointer-events-none p-5 bg-white/40 dark:bg-zinc-800/40 rounded-full backdrop-blur-sm"><ThumbsUp size={48} className="text-blue-500 fill-blue-500" /></motion.div>)}
            {gameState === "COUNTDOWN" && (<motion.div key="cd" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1.2, opacity: 0.5 }} exit={{ scale: 2, opacity: 0 }} className="absolute text-7xl font-black text-blue-600 drop-shadow-2xl">{countdown === 0 ? "GO!" : countdown}</motion.div>)}
            {gameState === "START" && (
              <motion.div key="sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center p-10 bg-white dark:bg-zinc-900 z-10">
                <div className="w-24 h-24 mb-6 shadow-2xl rotate-3 overflow-hidden rounded-3xl border-4 border-white dark:border-zinc-800"><img src="/Mascot.jpg" alt="M" className="w-full h-full object-cover" /></div>
                <h1 className="text-4xl font-black mb-1 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">INU BREAKOUT</h1>
                <p className="text-zinc-500 text-sm mb-10 text-center font-medium">부서진 빨간 벽돌 3개를 찾으세요!</p>
                <div className="w-full max-w-[280px] space-y-4">
                  <input type="text" placeholder="이름을 입력하세요" value={playerName} onChange={e => setPlayerName(e.target.value)} onKeyDown={e => e.key === "Enter" && startGame()} className="w-full px-6 py-4 bg-zinc-100 dark:bg-zinc-800 border-none rounded-2xl focus:ring-4 focus:ring-blue-500/20 outline-none text-center font-bold text-lg" />
                  <button onClick={startGame} className={`${BTN_BASE} ${BTN_DEFAULT} h-14 w-full gap-3 text-lg rounded-2xl shadow-lg shadow-blue-500/30 font-black`}><Play size={20} fill="currentColor" /> 게임 시작</button>
                </div>
              </motion.div>
            )}
            {(gameState === "GAME_OVER" || gameState === "WON") && (
              <motion.div key="res" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl z-20 text-center overflow-y-auto">
                <div className={`w-16 h-16 ${gameState === "WON" ? "opacity-100" : "grayscale opacity-50"} rounded-2xl overflow-hidden mb-4 shadow-2xl mx-auto border-2 border-white`}><img src="/Mascot.jpg" alt="R" className="w-full h-full object-cover" /></div>
                <h2 className="text-3xl font-black mb-1 uppercase tracking-tight">{gameState === "WON" ? "Perfect Clear!" : "Mission Failed"}</h2>
                <div className="w-full max-w-[340px] space-y-6 my-6 mx-auto">
                   {gameState === "WON" && (
                     <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-5 rounded-3xl border border-blue-100 dark:border-blue-900/50 shadow-inner">
                        <span className="text-[10px] text-blue-400 dark:text-blue-500 font-extrabold uppercase tracking-widest text-center block">Your Performance</span>
                        <div className="flex items-center justify-center gap-2 mt-2">
                          <Clock size={24} className="text-blue-500" />
                          <span className="font-mono font-black text-4xl text-zinc-900 dark:text-white leading-none">{finalTime || formatTime(time)}</span>
                        </div>
                        {isSaving && <div className="text-[9px] text-blue-500 font-bold animate-pulse mt-2 flex items-center justify-center gap-1"><Loader2 size={10} className="animate-spin" /> RECORD SAVING...</div>}
                     </motion.div>
                   )}
                   {gameState === "WON" && revealLeaderboard && (
                     <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full min-h-[140px]">
                       <div className="flex items-center gap-2 mb-3 px-3">
                         <Trophy size={16} className="text-amber-500 fill-amber-500" />
                         <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">Hall of Fame</span>
                       </div>
                       <AnimatePresence mode="popLayout">
                         {topRecords.length > 0 ? (
                           <div className="space-y-2">
                             {topRecords.map((r, i) => (
                               <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.1 }} key={i} className={`flex items-center justify-between p-4 ${i === 0 ? "bg-amber-50 dark:bg-amber-950/20 border-amber-100" : "bg-zinc-50 dark:bg-zinc-800/50 border-zinc-100 dark:border-zinc-800"} border rounded-[1.25rem] shadow-sm`}>
                                 <div className="flex items-center gap-3">
                                   <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-black ${i === 0 ? "bg-amber-500 text-white" : i === 1 ? "bg-zinc-400 text-white" : "bg-orange-400 text-white"}`}>{i + 1}</span>
                                   <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate w-24 text-left">{r.name}</span>
                                 </div>
                                 <span className="text-sm font-mono font-black text-blue-600 dark:text-blue-400">{cleanTime(r.finishtime)}</span>
                               </motion.div>
                             ))}
                           </div>
                         ) : !isLoadingLeaderboard && (
                           <div className="p-8 text-zinc-400 text-xs font-medium italic bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">첫 기록의 주인공이 되어보세요!</div>
                         )}
                       </AnimatePresence>
                     </motion.div>
                   )}
                </div>
                <button onClick={() => setGameState("START")} className={`${BTN_BASE} ${BTN_DEFAULT} h-14 px-12 text-lg rounded-2xl font-black w-full max-w-[300px]`}>메인으로 돌아가기</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
