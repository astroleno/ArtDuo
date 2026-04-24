import React, { useEffect, useRef } from 'react';

interface ParticleProps {
  mousePos: { x: number, y: number };
}

export const ParticleSystem: React.FC<ParticleProps> = ({ mousePos }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef(mousePos);
  
  useEffect(() => {
    mouseRef.current = mousePos;
  }, [mousePos]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particles = [];
      for (let i = 0; i < 80; i++) {
        particles.push(new Particle(canvas.width, canvas.height));
      }
    };

    class Particle {
      x: number;
      y: number;
      size: number;
      vx: number;
      vy: number;
      alpha: number;

      constructor(w: number, h: number) {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.size = Math.random() * 1.5;
        this.vx = (Math.random() - 0.5) * 0.2;
        this.vy = 0.1 + Math.random() * 0.3;
        this.alpha = 0.1 + Math.random() * 0.5;
      }

      update(w: number, h: number, mx: number, my: number) {
        // Subtle wind effect based on mouse X
        this.x += this.vx + (mx * -0.3);
        this.y += this.vy;

        if (this.y > h) {
          this.y = -10;
          this.x = Math.random() * w;
        }
        if (this.x > w) this.x = 0;
        if (this.x < 0) this.x = w;
      }

      draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
        // Approximate beam position
        const lightSourceX = w * 0.4 + (mouseRef.current.x * -60);
        const lightSourceY = -100;
        
        const beamCenterX = lightSourceX + (this.y - lightSourceY) * 0.3;
        const beamWidth = 100 + (this.y / h) * 600;

        const distFromBeamCenter = Math.abs(this.x - beamCenterX);
        
        // Only draw visible particles inside or near beam
        if (distFromBeamCenter < beamWidth) {
          const visibility = Math.max(0, 1 - (distFromBeamCenter / beamWidth));
          
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 250, 220, ${this.alpha * visibility * 0.6})`;
          ctx.fill();
        }
      }
    }

    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.update(canvas.width, canvas.height, mouseRef.current.x, mouseRef.current.y);
        p.draw(ctx, canvas.width, canvas.height);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 pointer-events-none z-20 mix-blend-screen"
    />
  );
};