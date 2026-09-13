/**
 * 黑洞背景效果
 * 粒子和细线向中心流动，黑洞中心会"注视"鼠标位置
 */

(function () {
    'use strict';

    // 配置
    const CONFIG = {
        particleCount: 150,      // 粒子数量
        lineCount: 80,           // 线条数量
        centerRadius: 150,       // 黑洞核心半径（150%大小：100 * 1.5 = 150）
        maxEyeOffset: 30,        // 眼睛最大偏移量
        particleSpeed: 0.5,      // 粒子基础速度
        lineSpeed: 0.3,          // 线条速度
        particleColor: 'rgba(139, 92, 246, ',  // 紫色粒子（不带透明度）
        lineColor: 'rgba(148, 163, 184, 0.08)',    // 灰色线条（更淡）
        glowColor: 'rgba(139, 92, 246, 0.15)'       // 黑洞光晕（透明度减半）
    };
    
    // 检测当前主题模式
    function isLightMode() {
        const root = document.documentElement;
        const theme = root.getAttribute('data-theme');
        if (theme === 'light') return true;
        if (theme === 'auto') {
            return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
        }
        return false;
    }

    let canvas, ctx;
    let centerX, centerY;
    let mouseX, mouseY;
    let eyeOffsetX = 0, eyeOffsetY = 0;
    let particles = [];
    let lines = [];
    let animationId = null;

    // 初始化
    function init() {
        canvas = document.getElementById('blackhole-canvas');
        if (!canvas) return;

        ctx = canvas.getContext('2d');
        resizeCanvas();

        mouseX = centerX;
        mouseY = centerY;

        createParticles();
        createLines();

        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('mousemove', handleMouseMove);
        // 移除滚动监听，因为时间区域是固定的，不需要监听滚动
        
        // 监听主题变化（亮色模式直接复用暗色模式，不需要特殊处理）
        const themeObserver = new MutationObserver(() => {
            // 主题变化时，只更新canvas尺寸
            resizeCanvas();
        });
        themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });
        
        // 监听系统主题变化（不需要特殊处理）
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
            mediaQuery.addEventListener('change', () => {
                // 系统主题变化时，只更新canvas尺寸
                resizeCanvas();
            });
        }
        
        // 定期更新黑洞位置（监听时间区域位置变化和滚动）
        setInterval(() => {
            resizeCanvas();
        }, 1000);

        animate();
    }

    function resizeCanvas() {
        const datetimeSection = document.getElementById('datetime-section');
        
        if (datetimeSection) {
            const rect = datetimeSection.getBoundingClientRect();
            // Canvas只覆盖时间区域，不超出
            canvas.width = window.innerWidth;
            canvas.height = rect.height; // 使用时间区域的高度（260px）
            
            // 黑洞中心位置：水平居中，垂直位置在时间区域中心
            centerX = canvas.width / 2;
            centerY = rect.height / 2; // 相对于canvas的垂直中心
        } else {
            // 如果找不到时间区域，使用默认设置
            canvas.width = window.innerWidth;
            canvas.height = 260;
            centerX = canvas.width / 2;
            centerY = 130; // 默认中心位置（260px的一半）
        }
    }

    function handleMouseMove(e) {
        // 将鼠标位置转换为相对于canvas的坐标
        const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    }

    // 创建粒子
    function createParticles() {
        particles = [];
        for (let i = 0; i < CONFIG.particleCount; i++) {
            particles.push(createParticle());
        }
    }

    function createParticle() {
        // 从边缘随机位置生成（限制在时间区域内）
        const angle = Math.random() * Math.PI * 2;
        // 使用canvas的尺寸限制生成范围，不超出时间区域
        const maxDistance = Math.max(canvas.width, canvas.height) * 0.6;
        const distance = maxDistance + Math.random() * 200;
        return {
            x: centerX + Math.cos(angle) * distance,
            y: centerY + Math.sin(angle) * distance,
            size: Math.random() * 2 + 1,
            speed: CONFIG.particleSpeed * (0.5 + Math.random() * 0.5),
            angle: angle + Math.PI,  // 向中心运动
            rotationSpeed: (Math.random() - 0.5) * 0.02,  // 螺旋效果
            opacity: 0.2 + Math.random() * 0.5,  // 随机透明度 0.2-0.7
            opacitySpeed: (Math.random() - 0.5) * 0.02  // 透明度变化速度
        };
    }

    // 创建线条
    function createLines() {
        lines = [];
        for (let i = 0; i < CONFIG.lineCount; i++) {
            lines.push(createLine());
        }
    }

    function createLine() {
        const angle = Math.random() * Math.PI * 2;
        // 限制生成范围在时间区域内
        const maxDistance = Math.max(canvas.width, canvas.height) * 0.5;
        const distance = maxDistance + Math.random() * 300;
        return {
            x: centerX + Math.cos(angle) * distance,
            y: centerY + Math.sin(angle) * distance,
            length: 30 + Math.random() * 60,
            speed: CONFIG.lineSpeed * (0.3 + Math.random() * 0.7),
            angle: angle + Math.PI
        };
    }

    // 更新眼睛位置
    function updateEyePosition() {
        const dx = mouseX - centerX;
        const dy = mouseY - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            const maxOffset = CONFIG.maxEyeOffset;
            const factor = Math.min(distance / 300, 1);
            eyeOffsetX += ((dx / distance) * maxOffset * factor - eyeOffsetX) * 0.1;
            eyeOffsetY += ((dy / distance) * maxOffset * factor - eyeOffsetY) * 0.1;
        }
    }

    // 更新粒子
    function updateParticles() {
        particles.forEach((p, index) => {
            // 向中心移动
            const dx = centerX - p.x;
            const dy = centerY - p.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < CONFIG.centerRadius) {
                // 重新生成粒子
                particles[index] = createParticle();
            } else {
                // 螺旋运动
                p.angle += p.rotationSpeed;
                const acceleration = 1 + (1 / (distance * 0.01));
                p.x += Math.cos(p.angle) * p.speed * acceleration;
                p.y += Math.sin(p.angle) * p.speed * acceleration;

                // 调整角度朝向中心
                const targetAngle = Math.atan2(dy, dx);
                const angleDiff = targetAngle - p.angle;
                p.angle += angleDiff * 0.02;

                // 随机透明度变化
                p.opacity += p.opacitySpeed;
                if (p.opacity <= 0.1 || p.opacity >= 0.7) {
                    p.opacitySpeed = -p.opacitySpeed;
                }
            }
        });
    }

    // 更新线条
    function updateLines() {
        lines.forEach((l, index) => {
            const dx = centerX - l.x;
            const dy = centerY - l.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < CONFIG.centerRadius + 20) {
                lines[index] = createLine();
            } else {
                const acceleration = 1 + (1 / (distance * 0.02));
                l.x += Math.cos(l.angle) * l.speed * acceleration;
                l.y += Math.sin(l.angle) * l.speed * acceleration;

                // 朝向中心
                const targetAngle = Math.atan2(dy, dx);
                l.angle = targetAngle;
            }
        });
    }

    // 绘制
    function draw() {
        const lightMode = isLightMode();
        
        // 清除画布（亮色模式使用浅色背景，与页面背景色一致）
        if (lightMode) {
            ctx.fillStyle = '#f1f5f9'; // 亮色模式背景色
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            // 亮色模式下不绘制任何效果
            return;
        } else {
            ctx.fillStyle = 'rgba(15, 23, 42, 1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // 绘制线条（仅暗色模式显示）
        ctx.strokeStyle = CONFIG.lineColor;
        ctx.lineWidth = 1;
        lines.forEach(l => {
            ctx.beginPath();
            ctx.moveTo(l.x, l.y);
            ctx.lineTo(
                l.x - Math.cos(l.angle) * l.length,
                l.y - Math.sin(l.angle) * l.length
            );
            ctx.stroke();
        });

        // 绘制粒子（仅暗色模式显示）
        particles.forEach(p => {
            const dx = centerX - p.x;
            const dy = centerY - p.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const distanceOpacity = Math.min(1, distance / 200);
            const finalOpacity = p.opacity * distanceOpacity;

            ctx.beginPath();
            ctx.fillStyle = CONFIG.particleColor + finalOpacity.toFixed(2) + ')';
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });

        // 绘制黑洞核心（仅暗色模式显示）
        drawBlackHole(lightMode);
    }

    function drawBlackHole(lightMode) {
        const holeX = centerX + eyeOffsetX * 0.5;
        const holeY = centerY + eyeOffsetY * 0.5;

        // 外层光晕
        const gradient = ctx.createRadialGradient(
            holeX, holeY, 0,
            holeX, holeY, CONFIG.centerRadius * 3
        );
        
        if (lightMode) {
            // 亮色模式：外层光晕使用 #C788FF
            gradient.addColorStop(0, 'rgba(199, 136, 255, 0.6)'); // 中心 #C788FF
            gradient.addColorStop(0.5, 'rgba(199, 136, 255, 0.4)'); // 中层 #C788FF
            gradient.addColorStop(1, 'rgba(199, 136, 255, 0.1)'); // 边缘 #C788FF
        } else {
            // 暗色模式：保持原有样式
            gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
            gradient.addColorStop(0.3, 'rgba(15, 23, 42, 0.9)');
            gradient.addColorStop(0.5, CONFIG.glowColor);
            gradient.addColorStop(1, 'transparent');
        }

        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(holeX, holeY, CONFIG.centerRadius * 3, 0, Math.PI * 2);
        ctx.fill();

        // 核心（亮色模式使用单色 #8B61B1，暗色模式保持黑色）
        ctx.beginPath();
        if (lightMode) {
            // 亮色模式：核心使用单色 #8B61B1
            ctx.fillStyle = '#8B61B1';
        } else {
            ctx.fillStyle = '#000';
        }
        ctx.arc(holeX, holeY, CONFIG.centerRadius, 0, Math.PI * 2);
        ctx.fill();

        // 眼睛效果（亮点）- 已删除
        // 不再绘制眼睛和亮点效果
    }

    function startAnimation() {
        if (animationId || document.hidden || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
            return;
        }
        animate();
    }

    function stopAnimation() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopAnimation();
        } else {
            startAnimation();
        }
    });

    function scheduleInit() {
        const run = () => {
            init();
            if (window.requestIdleCallback) {
                window.requestIdleCallback(startAnimation, { timeout: 1000 });
            } else {
                setTimeout(startAnimation, 0);
            }
        };
        if (window.requestIdleCallback) {
            window.requestIdleCallback(run, { timeout: 1200 });
        } else {
            setTimeout(run, 200);
        }
    }

    // DOM 加载完成后初始化；将粒子创建和动画让给空闲时段
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scheduleInit);
    } else {
        scheduleInit();
    }
})();
