import React, { useRef, useEffect, useState } from 'react';
import { type GameState } from '@shared/schema';

interface GameCanvasProps {
  gameState: GameState | null;
  myPlayerId?: number;
  onInput: (x: number, y: number, attack: boolean) => void;
}

export function GameCanvas({ gameState, myPlayerId, onInput }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef({ clicked: false });
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const assetsRef = useRef<{ characters: HTMLImageElement | null; tileset: HTMLImageElement | null }>({
    characters: null,
    tileset: null,
  });

  useEffect(() => {
    const chars = new Image();
    chars.src = '/images/characters.png';
    const tiles = new Image();
    tiles.src = '/images/tileset.png';

    let loadedCount = 0;
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount === 2) {
        assetsRef.current.characters = chars;
        assetsRef.current.tileset = tiles;
        setAssetsLoaded(true);
      }
    };

    chars.onload = checkLoaded;
    tiles.onload = checkLoaded;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keysRef.current.add(e.code);
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.code);
    const handleMouseDown = () => {
      mouseRef.current.clicked = true;
    };
    const handleMouseUp = () => {
      mouseRef.current.clicked = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      let x = 0;
      let y = 0;

      if (keysRef.current.has('KeyW') || keysRef.current.has('ArrowUp')) y -= 1;
      if (keysRef.current.has('KeyS') || keysRef.current.has('ArrowDown')) y += 1;
      if (keysRef.current.has('KeyA') || keysRef.current.has('ArrowLeft')) x -= 1;
      if (keysRef.current.has('KeyD') || keysRef.current.has('ArrowRight')) x += 1;

      if (x !== 0 || y !== 0) {
        const length = Math.sqrt(x * x + y * y);
        x /= length;
        y /= length;
      }

      onInput(x, y, mouseRef.current.clicked || keysRef.current.has('Space'));
    }, 1000 / 30);

    return () => clearInterval(interval);
  }, [onInput]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState.phase === 'courtyard') {
      ctx.fillStyle = '#134e4a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#292524';
      ctx.fillRect(canvas.width - 170, canvas.height / 2 - 110, 120, 220);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(canvas.width - 162, canvas.height / 2 - 102, 104, 204);
      ctx.fillStyle = '#111827';
      ctx.fillRect(canvas.width - 152, canvas.height / 2 - 92, 84, 184);
    } else {
      const { tileset } = assetsRef.current;
      if (tileset && assetsLoaded) {
        const tileSize = 32;
        for (let x = 0; x < canvas.width; x += tileSize) {
          for (let y = 0; y < canvas.height; y += tileSize) {
            ctx.drawImage(tileset, 0, 0, 32, 32, x, y, tileSize, tileSize);
            if (x === 0 || x >= canvas.width - tileSize || y === 0 || y >= canvas.height - tileSize) {
              ctx.drawImage(tileset, 32, 0, 32, 32, x, y, tileSize, tileSize);
            }
          }
        }
      }
    }

    gameState.enemies.forEach((enemy) => {
      ctx.fillStyle = enemy.type === 'boss' ? '#dc2626' : enemy.type === 'orc' ? '#ea580c' : '#f87171';
      const size = enemy.type === 'boss' ? 56 : enemy.type === 'orc' ? 30 : 24;
      ctx.fillRect(enemy.position.x - size / 2, enemy.position.y - size / 2, size, size);
      renderHealthBar(ctx, enemy.position.x, enemy.position.y - size / 2 - 10, enemy.health, enemy.maxHealth, size);
    });

    const { characters } = assetsRef.current;
    gameState.players.forEach((player) => {
      if (player.isDead) return;
      const isMe = player.id === myPlayerId;

      if (characters && assetsLoaded) {
        const roles = ['swordsman', 'beast', 'archer', 'mage', 'healer'];
        const roleIndex = Math.max(0, roles.indexOf(player.role));

        ctx.save();
        if (player.facing === 'left') {
          ctx.translate(player.position.x * 2, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(characters, roleIndex * 32, 0, 32, 32, player.position.x - 16, player.position.y - 16, 32, 32);
        } else {
          ctx.drawImage(characters, roleIndex * 32, 0, 32, 32, player.position.x - 16, player.position.y - 16, 32, 32);
        }
        ctx.restore();
      } else {
        ctx.fillStyle = getRoleColor(player.role);
        ctx.fillRect(player.position.x - 12, player.position.y - 12, 24, 24);
      }

      if (isMe) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(player.position.x - 18, player.position.y - 18, 36, 36);
      }

      if (player.isAttacking) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(player.position.x, player.position.y, 40, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = '#fff';
      ctx.font = '10px "Oxanium"';
      ctx.textAlign = 'center';
      ctx.fillText(player.name, player.position.x, player.position.y - 25);
      renderHealthBar(ctx, player.position.x, player.position.y - 20, player.health, player.maxHealth, 30);
    });
  }, [gameState, myPlayerId, assetsLoaded]);

  return <canvas ref={canvasRef} width={800} height={600} className="w-full h-full object-contain bg-black rounded-lg border-4 border-muted shadow-2xl image-pixelated cursor-crosshair" style={{ imageRendering: 'pixelated' }} />;
}

function getRoleColor(role: string): string {
  switch (role) {
    case 'swordsman':
      return '#3b82f6';
    case 'beast':
      return '#a855f7';
    case 'archer':
      return '#22c55e';
    case 'mage':
      return '#06b6d4';
    case 'healer':
      return '#eab308';
    default:
      return '#94a3b8';
  }
}

function renderHealthBar(ctx: CanvasRenderingContext2D, x: number, y: number, current: number, max: number, width: number) {
  const height = 4;
  ctx.fillStyle = '#333';
  ctx.fillRect(x - width / 2, y, width, height);
  const pct = Math.max(0, current / max);
  ctx.fillStyle = pct > 0.5 ? '#22c55e' : pct > 0.2 ? '#eab308' : '#ef4444';
  ctx.fillRect(x - width / 2, y, width * pct, height);
}
