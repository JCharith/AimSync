export function draw3DBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.8);
    gradient.addColorStop(0, "#1F2937"); 
    gradient.addColorStop(1, "#030712"); 

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    
    // Horizon line
    const horizon = height * 0.3;
    ctx.moveTo(0, horizon);
    ctx.lineTo(width, horizon);
    
    // Perspective Floor Lines
    const focalX = width / 2;
    const focalY = horizon - 100;
    const numLines = 30;
    const spacing = width / (numLines / 1.5);
    
    for (let i = -numLines; i <= numLines * 2; i++) {
        const x = i * spacing;
        ctx.moveTo(focalX, focalY);
        ctx.lineTo(x, height);
    }
    
    // Horizontal Floor Lines (Depth)
    let currentY = horizon;
    let gap = 2;
    while (currentY < height) {
        ctx.moveTo(0, currentY);
        ctx.lineTo(width, currentY);
        currentY += gap;
        gap *= 1.15; 
    }
    ctx.stroke();

    // Fade the horizon so it looks like a deep room
    const horizonFade = ctx.createLinearGradient(0, horizon - 50, 0, horizon + 150);
    horizonFade.addColorStop(0, "#030712");
    horizonFade.addColorStop(0.5, "transparent");
    horizonFade.addColorStop(1, "transparent");
    ctx.fillStyle = horizonFade;
    ctx.fillRect(0, 0, width, height);
}

export type TargetTheme = "emerald" | "red" | "cyan" | "violet";

export function draw3DTarget(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, theme: TargetTheme = "emerald", time: number = 0) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    
    // Heavy 3D Drop Shadow
    ctx.shadowColor = theme === "emerald" ? "rgba(16, 185, 129, 0.5)" : theme === "red" ? "rgba(239, 68, 68, 0.5)" : "rgba(6, 182, 212, 0.5)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    
    // Specular Highlight
    const grad = ctx.createRadialGradient(
        x - radius * 0.3, y - radius * 0.3, radius * 0.05, 
        x, y, radius
    );
    
    if (theme === "emerald") {
        grad.addColorStop(0, "#D1FAE5");
        grad.addColorStop(0.3, "#10B981");
        grad.addColorStop(0.8, "#047857");
        grad.addColorStop(1, "#022C22");
    } else if (theme === "red") {
        grad.addColorStop(0, "#FEE2E2");
        grad.addColorStop(0.3, "#EF4444");
        grad.addColorStop(0.8, "#B91C1C");
        grad.addColorStop(1, "#450A0A");
    } else if (theme === "cyan") {
        grad.addColorStop(0, "#CFFAFE");
        grad.addColorStop(0.3, "#06B6D4");
        grad.addColorStop(0.8, "#0E7490");
        grad.addColorStop(1, "#083344");
    } else if (theme === "violet") {
        grad.addColorStop(0, "#EDE9FE");
        grad.addColorStop(0.3, "#8B5CF6");
        grad.addColorStop(0.8, "#6D28D9");
        grad.addColorStop(1, "#2E1065");
    }
    
    ctx.fillStyle = grad;
    ctx.fill();
    
    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    
    // Holographic Core Glow
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.95, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.fill();

    // ----------------------------------------------------
    // Fully 3D Rotating Holographic Contour Rings (Globes)
    // ----------------------------------------------------
    const rotationSpeed = time * 0.001; // Continuous spin
    ctx.lineWidth = radius * 0.08;
    ctx.strokeStyle = theme === "emerald" ? "rgba(16, 185, 129, 0.6)" : theme === "red" ? "rgba(239, 68, 68, 0.6)" : "rgba(6, 182, 212, 0.6)";
    
    ctx.save();
    ctx.translate(x, y);
    
    // Base Tilt
    ctx.rotate(-Math.PI / 8);

    // Draw Longitude Rings (Vertical)
    const numLong = 3;
    for (let i = 0; i < numLong; i++) {
        const offsetAxis = (i / numLong) * Math.PI + rotationSpeed;
        const scaleX = Math.cos(offsetAxis);
        
        ctx.beginPath();
        // Ellipse (x, y, radiusX, radiusY, rotation, startAngle, endAngle)
        ctx.ellipse(0, 0, Math.abs(radius * scaleX), radius * 0.98, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // Draw Latitude Rings (Horizontal)
    const numLat = 3;
    for (let i = 1; i <= numLat; i++) {
        const yPos = (i / (numLat + 1)) * (radius * 2) - radius;
        const currentRingRadius = Math.sqrt(radius * radius - yPos * yPos);
        
        // Tilt the horizontal axis by oscillating it
        const tilt = Math.sin(rotationSpeed * 0.5) * 0.2;
        
        ctx.beginPath();
        ctx.ellipse(0, yPos, currentRingRadius, currentRingRadius * (0.2 + Math.abs(tilt)), 0, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.restore();

    // Specular Reflection (Glossy Rim) overlay on top
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.88, Math.PI * 1.2, Math.PI * 1.8);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineCap = "round";
    ctx.lineWidth = radius * 0.15;
    ctx.stroke();
}

export interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    life: number;
    maxLife: number;
    rotation: number;
    vr: number;
}

export class ParticleEngine {
    particles: Particle[] = [];

    spawnExplosion(x: number, y: number, radius: number, isHit: boolean) {
        const numParticles = Math.floor(radius * 1.5) + 15;
        const color = isHit ? "#10B981" : "#EF4444";
        
        for (let i = 0; i < numParticles; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 12 + 2;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 4, // Upward burst
                size: Math.random() * (radius / 2.5) + 2,
                color: Math.random() > 0.85 ? "#ffffff" : color,
                life: 0,
                maxLife: Math.random() * 30 + 40,
                rotation: Math.random() * Math.PI * 2,
                vr: (Math.random() - 0.5) * 0.8
            });
        }
    }

    spawnTrail(x: number, y: number, radius: number, color: string) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;
        this.particles.push({
            x: x + (Math.random() - 0.5) * radius,
            y: y + (Math.random() - 0.5) * radius,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: Math.random() * 5 + 2,
            color,
            life: 0,
            maxLife: Math.random() * 15 + 15,
            rotation: Math.random() * Math.PI * 2,
            vr: (Math.random() - 0.5) * 0.4
        });
    }

    updateAndDraw(ctx: CanvasRenderingContext2D) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            p.life++;
            if (p.life >= p.maxLife) {
                this.particles.splice(i, 1);
                continue;
            }
            
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.4; // Strong Gravity
            p.vx *= 0.97; // Air friction
            p.vy *= 0.97;
            p.rotation += p.vr;
            
            const progress = p.life / p.maxLife;
            const alpha = 1 - Math.pow(progress, 2); 
            
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, alpha);
            
            // Draw a polygon shard
            ctx.beginPath();
            ctx.moveTo(-p.size/2, -p.size/2);
            ctx.lineTo(p.size/2, -p.size/4);
            ctx.lineTo(p.size/3, p.size/2);
            ctx.lineTo(-p.size/2, p.size/3);
            ctx.closePath();
            ctx.fill();
            
            ctx.restore();
        }
        ctx.globalAlpha = 1.0;
    }
}
