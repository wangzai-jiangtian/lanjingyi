/**
 * ============================================================================
 * 贪吃蛇高级版 (Snake Game Advanced Edition)
 * 作者: Jingyi Lan
 * ============================================================================
 * 这个游戏集成了多种系统以提供丰富的游戏体验：
 * 1. 音频管理器 (AudioManager): 控制背景音乐与各种游戏音效。
 * 2. 主题管理器 (ThemeManager): 支持切换不同的游戏地图背景与配色主题。
 * 3. 粒子系统 (ParticleSystem): 提供丰富的视觉特效（吃到食物、撞墙等）。
 * 4. 障碍物与关卡生成器 (ObstacleManager): 动态生成并管理地图中的障碍物。
 * 5. 多样化道具系统 (ItemManager & Food): 提供增益和减益等多种特殊道具。
 * 6. 排行榜与成就系统 (LeaderboardManager): 基于本地存储的持久化数据记录。
 * 7. 蛇和核心控制引擎 (Snake & Game): 核心游戏循环与控制逻辑。
 * ============================================================================
 */

// ==========================================
// 工具与常量 (Utils & Constants)
// ==========================================
const CONSTANTS = {
    CELL_SIZE: 20,
    FPS_DEFAULT: 300,
    FPS_HARD: 100,
    FPS_NORMAL: 200,
    FPS_EASY: 300
};

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function hexToRgba(hex, alpha) {
    let r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ==========================================
// 音频管理系统 (AudioManager)
// ==========================================
/**
 * 负责管理背景音乐(BGM)和音效(SFX)。
 * [修改指南]
 * 若要替换音乐，请在下面 bgmList 中替换地址。
 */
class AudioManager {
    constructor() {
        this.isMuted = localStorage.getItem('snake_isMuted') === 'true';
        
        // 创建背景音乐音频对象
        this.bgmAudio = new Audio();
        this.bgmAudio.loop = true;
        this.bgmAudio.volume = this.isMuted ? 0 : 0.5;
        
        // 【修改此处：替换背景音乐的本地路径或URL】
        this.bgmList = [
            'music/music1.mp3',
            'music/music2.mp3',
            'music/music3.mp3',
            'music/music4.mp3',
            'music/music5.mp3',
            'music/music6.mp3',
            'music/music7.mp3',
            'music/music8.mp3'
        ];
        this.currentBgmIndex = parseInt(localStorage.getItem('snake_bgmIndex')) || 0;
        this.bgmAudio.src = this.bgmList[this.currentBgmIndex];

        // 音频池：用于音效，防止连续播放时互相覆盖
        this.sfxPool = {};
    }

    // 初始化/预加载音效
    initSfx() {
        // [修改此处：如果你有音效文件，可以在这里指定路径。此处为了不报错，使用静音或者简单的空串，后续可通过 web audio api 合成]
        this.createSynthBeep('eat', 600, 'sine', 0.1);
        this.createSynthBeep('die', 150, 'sawtooth', 0.5);
        this.createSynthBeep('powerup', 1200, 'square', 0.2);
        this.createSynthBeep('poison', 200, 'triangle', 0.3);
    }

    // 利用 Web Audio API 动态合成简易音效，不需要外部文件
    createSynthBeep(name, frequency, type, duration) {
        this.sfxPool[name] = () => {
            if (this.isMuted) return;
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) return;
                const ctx = new AudioContext();
                const osc = ctx.createOscillator();
                const gainNode = ctx.createGain();
                
                osc.type = type;
                osc.frequency.setValueAtTime(frequency, ctx.currentTime);
                // 简单的衰减包络
                gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
                
                osc.connect(gainNode);
                gainNode.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + duration);
            } catch (e) {
                console.log("Audio API not supported or interaction needed");
            }
        };
    }

    playBgm() {
        if (!this.isMuted) {
            // 确保每次播放都是从头开始或者继续播放
            let playPromise = this.bgmAudio.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.log("浏览器限制了自动播放，需要用户点击页面后才能播放声音");
                });
            }
        }
    }

    pauseBgm() {
        this.bgmAudio.pause();
    }

    nextBgm() {
        this.currentBgmIndex = (this.currentBgmIndex + 1) % this.bgmList.length;
        localStorage.setItem('snake_bgmIndex', this.currentBgmIndex);
        this.bgmAudio.src = this.bgmList[this.currentBgmIndex];
        if (!this.bgmAudio.paused) {
            this.playBgm();
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        localStorage.setItem('snake_isMuted', this.isMuted);
        if (this.isMuted) {
            this.bgmAudio.volume = 0;
        } else {
            this.bgmAudio.volume = 0.5;
        }
        return this.isMuted;
    }

    playSfx(name) {
        if (this.sfxPool[name] && !this.isMuted) {
            this.sfxPool[name]();
        }
    }
}

// ==========================================
// 主题管理器 (ThemeManager)
// ==========================================
/**
 * 控制游戏界面的外观。
 */
class ThemeManager {
    constructor(mapElement) {
        this.mapElement = mapElement;
        
        // 背景库定义
        this.backgrounds = [
            { name: 'Pure Black', value: '#000000', gridColor: 'rgba(255,255,255,0.05)' },
            { name: 'Background 1', value: 'url(background/bg1.png) center/cover', gridColor: 'rgba(255,255,255,0.1)' },
            { name: 'Background 2', value: 'url(background/bg2.png) center/cover', gridColor: 'rgba(255,255,255,0.1)' },
            { name: 'Background 3', value: 'url(background/bg3.png) center/cover', gridColor: 'rgba(255,255,255,0.1)' },
            { name: 'Background 4', value: 'url(background/bg4.png) center/cover', gridColor: 'rgba(255,255,255,0.1)' },
            { name: 'Background 5', value: 'url(background/bg5.png) center/cover', gridColor: 'rgba(255,255,255,0.1)' },
            { name: 'Background 6', value: 'url(background/bg6.png) center/cover', gridColor: 'rgba(255,255,255,0.1)' },
            { name: 'Background 7', value: 'url(background/bg7.png) center/cover', gridColor: 'rgba(255,255,255,0.1)' },
            { name: 'Background 8', value: 'url(background/bg8.png) center/cover', gridColor: 'rgba(255,255,255,0.1)' },
            { name: 'Background 9', value: 'url(background/bg9.png) center/cover', gridColor: 'rgba(255,255,255,0.1)' },
            { name: 'Background 10', value: 'url(background/bg10.png) center/cover', gridColor: 'rgba(255,255,255,0.1)' },
            { name: 'Background 11', value: 'url(background/bg11.png) center/cover', gridColor: 'rgba(255,255,255,0.1)' }

        ];

        // 蛇皮库定义
        this.skins = [
            { name: 'Orange', snakeHead: 'radial-gradient(#ffc000, #ff4e00)', snakeBody: 'radial-gradient(#ffc369, #fa791a)' },
            { name: 'Green', snakeHead: 'radial-gradient(#00ff00, #008800)', snakeBody: 'radial-gradient(#55ff55, #00aa00)' },
            { name: 'Blue', snakeHead: 'radial-gradient(#00d2ff, #3a7bd5)', snakeBody: 'radial-gradient(#8ec5fc, #e0c3fc)' },
            { name: 'Purple', snakeHead: 'radial-gradient(#d53aff, #7300ff)', snakeBody: 'radial-gradient(#e68efc, #a155ff)' },
            { name: 'White', snakeHead: 'radial-gradient(#ffffff, #cccccc)', snakeBody: 'radial-gradient(#eeeeee, #aaaaaa)' }
        ];
        
        this.currentBgIndex = parseInt(localStorage.getItem('snake_bgIndex')) || 0;
        this.currentSkinIndex = parseInt(localStorage.getItem('snake_skinIndex')) || 0;
        
        this.applyTheme();
    }

    applyTheme() {
        const bg = this.backgrounds[this.currentBgIndex];
        const skin = this.skins[this.currentSkinIndex];

        // 应用背景
        this.mapElement.style.background = bg.value;
        
        // 动态更新 CSS 变量以改变蛇的颜色
        let styleTag = document.getElementById('dynamic-snake-style');
        if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = 'dynamic-snake-style';
            document.head.appendChild(styleTag);
        }
        
        styleTag.innerHTML = `
            .snake-head { background: ${skin.snakeHead} !important; }
            .snake-body { background: ${skin.snakeBody} !important; }
        `;

        this.drawGrid();
    }

    nextBackground() {
        this.currentBgIndex = (this.currentBgIndex + 1) % this.backgrounds.length;
        localStorage.setItem('snake_bgIndex', this.currentBgIndex);
        this.applyTheme();
    }

    nextSkin() {
        this.currentSkinIndex = (this.currentSkinIndex + 1) % this.skins.length;
        localStorage.setItem('snake_skinIndex', this.currentSkinIndex);
        this.applyTheme();
    }

    // 绘制网格背景
    drawGrid() {
        const bg = this.backgrounds[this.currentBgIndex];
        // 移除旧网格
        const oldGrid = document.getElementById('game-grid-layer');
        if (oldGrid) oldGrid.remove();

        const gridLayer = document.createElement('div');
        gridLayer.id = 'game-grid-layer';
        gridLayer.style.position = 'absolute';
        gridLayer.style.top = '0';
        gridLayer.style.left = '0';
        gridLayer.style.width = '100%';
        gridLayer.style.height = '100%';
        gridLayer.style.pointerEvents = 'none';
        gridLayer.style.zIndex = '0'; // 放在最底层

        // 使用线性渐变绘制网格
        const size = CONSTANTS.CELL_SIZE;
        gridLayer.style.backgroundImage = `
            linear-gradient(to right, ${bg.gridColor} 1px, transparent 1px),
            linear-gradient(to bottom, ${bg.gridColor} 1px, transparent 1px)
        `;
        gridLayer.style.backgroundSize = `${size}px ${size}px`;
        
        this.mapElement.appendChild(gridLayer);
    }
}

// ==========================================
// 粒子系统引擎 (ParticleEngine)
// ==========================================
/**
 * 用于生成吃食物、死亡时的特效。
 */
class Particle {
    constructor(x, y, color, speed, size) {
        this.x = x;
        this.y = y;
        this.color = color;
        // 随机发散角度和速度
        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * speed + 1;
        this.vx = Math.cos(angle) * velocity;
        this.vy = Math.sin(angle) * velocity;
        this.size = Math.random() * size + 2;
        this.life = 1.0; // 寿命 1.0 到 0
        this.decay = Math.random() * 0.05 + 0.02; // 衰减速度
        
        this.element = document.createElement('div');
        this.element.style.position = 'absolute';
        this.element.style.width = this.size + 'px';
        this.element.style.height = this.size + 'px';
        this.element.style.backgroundColor = this.color;
        this.element.style.borderRadius = '50%';
        this.element.style.pointerEvents = 'none';
        this.element.style.zIndex = '10';
        this.element.style.boxShadow = `0 0 ${this.size}px ${this.color}`;
        this.updateStyle();
    }

    updateStyle() {
        this.element.style.left = this.x + 'px';
        this.element.style.top = this.y + 'px';
        this.element.style.opacity = this.life;
        this.element.style.transform = `scale(${this.life})`;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        this.updateStyle();
        return this.life > 0;
    }
}

class ParticleEngine {
    constructor(mapElement) {
        this.mapElement = mapElement;
        this.particles = [];
        this.isRunning = false;
        this.animationFrameId = null;
    }

    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.loop();
        }
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        // 清理所有粒子
        this.particles.forEach(p => p.element.remove());
        this.particles = [];
    }

    emit(x, y, count, color, speed = 5, size = 6) {
        // 为了对齐中心，调整发射点
        const emitX = x + CONSTANTS.CELL_SIZE / 2;
        const emitY = y + CONSTANTS.CELL_SIZE / 2;
        
        for (let i = 0; i < count; i++) {
            const p = new Particle(emitX, emitY, color, speed, size);
            this.mapElement.appendChild(p.element);
            this.particles.push(p);
        }
        this.start();
    }

    loop() {
        if (!this.isRunning) return;

        // 倒序遍历以便安全删除
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            if (!p.update()) {
                p.element.remove();
                this.particles.splice(i, 1);
            }
        }

        if (this.particles.length > 0) {
            this.animationFrameId = requestAnimationFrame(() => this.loop());
        } else {
            this.isRunning = false; // 没有粒子则暂停循环节省性能
        }
    }
}

// ==========================================
// 本地存储排行榜 (LeaderboardManager)
// ==========================================
/**
 * 利用 localStorage 保存历史最高分等数据
 */
class LeaderboardManager {
    constructor() {
        this.storageKey = 'snake_game_leaderboard_v1';
        this.loadData();
    }

    loadData() {
        const rawData = localStorage.getItem(this.storageKey);
        if (rawData) {
            try {
                this.data = JSON.parse(rawData);
            } catch (e) {
                this.initData();
            }
        } else {
            this.initData();
        }
    }

    initData() {
        this.data = {
            highScore: 0,
            playCount: 0,
            totalFoodEaten: 0,
            history: [] // 记录最近的几场得分
        };
        this.saveData();
    }

    saveData() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    }

    recordGameStart() {
        this.data.playCount++;
        this.saveData();
    }

    recordFood() {
        this.data.totalFoodEaten++;
        // 降低保存频率以提升性能，只在游戏结束时保存总数也可以
    }

    recordGameOver(score) {
        let isNewHigh = false;
        if (score > this.data.highScore) {
            this.data.highScore = score;
            isNewHigh = true;
        }

        this.data.history.unshift({
            date: new Date().toLocaleDateString(),
            score: score
        });
        
        // 只保留最近10条
        if (this.data.history.length > 10) {
            this.data.history.pop();
        }

        this.saveData();
        return isNewHigh;
    }

    getHighScore() {
        return this.data.highScore;
    }

    getStats() {
        return this.data;
    }
}

// ==========================================
// 关卡与障碍系统 (ObstacleManager)
// ==========================================
/**
 * 负责生成地图上的障碍物(墙壁)。
 */
class ObstacleManager {
    constructor(mapElement) {
        this.mapElement = mapElement;
        this.obstacles = [];
        this.elements = [];
        
        this.cols = Math.floor(this.mapElement.offsetWidth / CONSTANTS.CELL_SIZE);
        this.rows = Math.floor(this.mapElement.offsetHeight / CONSTANTS.CELL_SIZE);
    }

    clear() {
        this.elements.forEach(el => el.remove());
        this.elements = [];
        this.obstacles = [];
    }

    // 生成边框障碍物
    generateBorders() {
        this.clear();
        
        // 顶部和底部墙
        for (let x = 0; x < this.cols; x++) {
            this.addObstacle(x, 0);
            this.addObstacle(x, this.rows - 1);
        }
        // 左侧和右侧墙
        for (let y = 1; y < this.rows - 1; y++) {
            this.addObstacle(0, y);
            this.addObstacle(this.cols - 1, y);
        }
    }

    // 生成随机障碍物
    generateRandom(count, safeAreaRect) {
        let added = 0;
        let attempts = 0;
        
        while (added < count && attempts < count * 5) {
            attempts++;
            const rx = randomInt(1, this.cols - 2);
            const ry = randomInt(1, this.rows - 2);
            
            // 避开安全区(蛇的初始位置)
            if (rx >= safeAreaRect.x && rx <= safeAreaRect.x + safeAreaRect.w &&
                ry >= safeAreaRect.y && ry <= safeAreaRect.y + safeAreaRect.h) {
                continue;
            }

            // 检查是否已经有障碍物
            if (!this.isObstacle(rx * CONSTANTS.CELL_SIZE, ry * CONSTANTS.CELL_SIZE)) {
                this.addObstacle(rx, ry);
                added++;
            }
        }
    }

    addObstacle(gridX, gridY) {
        const x = gridX * CONSTANTS.CELL_SIZE;
        const y = gridY * CONSTANTS.CELL_SIZE;
        
        const el = document.createElement('div');
        el.className = 'obstacle';
        el.style.position = 'absolute';
        el.style.left = x + 'px';
        el.style.top = y + 'px';
        el.style.width = CONSTANTS.CELL_SIZE + 'px';
        el.style.height = CONSTANTS.CELL_SIZE + 'px';
        el.style.backgroundColor = '#555';
        el.style.boxShadow = 'inset 0 0 5px #000';
        el.style.borderRadius = '3px';
        el.style.zIndex = '5';
        
        this.mapElement.appendChild(el);
        this.obstacles.push({ x, y });
        this.elements.push(el);
    }

    isObstacle(x, y) {
        return this.obstacles.some(obs => obs.x === x && obs.y === y);
    }
}

// ==========================================
// 道具系统与食物 (ItemManager & Special Foods)
// ==========================================
const ITEM_TYPES = {
    NORMAL: { type: 'NORMAL', color: '#a7fa64', emoji: '', score: 1, duration: 0, prob: 70 },
    DOUBLE: { type: 'DOUBLE', color: '#ffd700', emoji: '🌟', score: 2, duration: 0, prob: 10 },
    SPEED:  { type: 'SPEED', color: '#00ffff', emoji: '⚡', score: 1, duration: 5000, prob: 10 }, // 加速药水
    POISON: { type: 'POISON', color: '#a020f0', emoji: '💀', score: -1, duration: 5000, prob: 5 }, // 毒药，扣分或减速
    SCISSORS: { type: 'SCISSORS', color: '#ff4444', emoji: '✂️', score: 1, duration: 0, prob: 5 } // 剪尾巴
};

class FoodItem {
    constructor(mapElement, obstacleManager, x, y, typeInfo) {
        this.gameMap = mapElement;
        this.obstacleManager = obstacleManager;
        this.typeInfo = typeInfo;
        
        this.element = document.createElement('div');
        this.element.className = 'food special-food';
        this.element.style.position = 'absolute';
        this.element.style.width = CONSTANTS.CELL_SIZE + 'px';
        this.element.style.height = CONSTANTS.CELL_SIZE + 'px';
        this.element.style.borderRadius = '50%';
        
        // 居中显示 emoji
        this.element.style.display = 'flex';
        this.element.style.alignItems = 'center';
        this.element.style.justifyContent = 'center';
        this.element.style.fontSize = (CONSTANTS.CELL_SIZE * 0.7) + 'px';
        
        // 如果是特殊道具，移除动画发光，使用绝对纯色和 Emoji
        if (this.typeInfo.type !== 'NORMAL') {
            this.element.style.setProperty('background', this.typeInfo.color, 'important');
            this.element.style.setProperty('box-shadow', 'none', 'important');
            this.element.style.setProperty('animation', 'none', 'important'); // 禁用发光动画
            this.element.innerHTML = this.typeInfo.emoji;
        } else {
            // 普通食物保持原来原版那种原谅绿即可
            this.element.style.setProperty('background', this.typeInfo.color, 'important');
        }
        
        this.element.style.zIndex = '8';
        
        this.gameMap.appendChild(this.element);
        
        this.x = x;
        this.y = y;
        this.element.style.left = this.x + 'px';
        this.element.style.top = this.y + 'px';

        // 有些道具可能有过期时间
        this.creationTime = Date.now();
        this.expireTime = 10000; // 10秒后消失（非普通食物）
        if (this.typeInfo.type === 'NORMAL') {
            this.expireTime = Infinity;
        }
    }

    isExpired() {
        if (this.typeInfo.type === 'NORMAL') return false;
        return Date.now() - this.creationTime > this.expireTime;
    }

    remove() {
        this.element.remove();
    }
}

class ItemManager {
    constructor(mapElement, obstacleManager) {
        this.mapElement = mapElement;
        this.obstacleManager = obstacleManager;
        this.items = [];
        
        this.cols = Math.floor(this.mapElement.offsetWidth / CONSTANTS.CELL_SIZE);
        this.rows = Math.floor(this.mapElement.offsetHeight / CONSTANTS.CELL_SIZE);
    }

    clear() {
        this.items.forEach(item => item.remove());
        this.items = [];
    }

    update() {
        // 清理过期道具
        for (let i = this.items.length - 1; i >= 0; i--) {
            if (this.items[i].isExpired()) {
                this.items[i].remove();
                this.items.splice(i, 1);
            }
        }

        // 确保场上至少有一个食物，优先生成普通食物
        if (this.items.length === 0) {
            this.generateItem(ITEM_TYPES.NORMAL);
        }
        
        // 增加特殊食物的生成频率：如果场上食物不到3个，有 10% 的概率生成特殊道具
        if (this.items.length < 3 && Math.random() < 0.1) {
            this.generateRandomSpecialItem();
        }
    }

    generateRandomSpecialItem() {
        const rand = Math.random() * 100;
        let cumulativeProb = 0;
        let selectedType = ITEM_TYPES.NORMAL;

        // 计算所有特殊物品的总概率权重
        let totalSpecialProb = 0;
        for (const key in ITEM_TYPES) {
            if (ITEM_TYPES[key].type === 'NORMAL') continue;
            totalSpecialProb += ITEM_TYPES[key].prob;
        }

        // 按权重随机选择特殊物品
        const normalizedRand = Math.random() * totalSpecialProb;
        
        for (const key in ITEM_TYPES) {
            if (ITEM_TYPES[key].type === 'NORMAL') continue;
            cumulativeProb += ITEM_TYPES[key].prob;
            if (normalizedRand <= cumulativeProb) {
                selectedType = ITEM_TYPES[key];
                break;
            }
        }
        
        // 如果选中的不是 NORMAL，才生成
        if (selectedType.type !== 'NORMAL') {
            this.generateItem(selectedType);
        }
    }

    generateItem(typeInfo) {
        let x, y;
        let valid = false;
        let attempts = 0;

        while (!valid && attempts < 100) {
            attempts++;
            x = randomInt(0, this.cols - 1) * CONSTANTS.CELL_SIZE;
            y = randomInt(0, this.rows - 1) * CONSTANTS.CELL_SIZE;

            // 检查是否与墙重合
            if (this.obstacleManager && this.obstacleManager.isObstacle(x, y)) {
                continue;
            }

            // 检查是否与其他道具重合
            if (this.items.some(item => item.x === x && item.y === y)) {
                continue;
            }

            // 实际应用中还需要检查是否与蛇身重合，这部分校验在 Snake 类创建新食物时配合
            valid = true;
        }

        if (valid) {
            const item = new FoodItem(this.mapElement, this.obstacleManager, x, y, typeInfo);
            this.items.push(item);
        }
    }

    checkCollision(headX, headY) {
        for (let i = 0; i < this.items.length; i++) {
            if (this.items[i].x === headX && this.items[i].y === headY) {
                const collidedItem = this.items[i];
                this.items.splice(i, 1);
                collidedItem.remove();
                return collidedItem.typeInfo;
            }
        }
        return null;
    }
}

// ==========================================
// 核心逻辑：蛇 (Snake)
// ==========================================
class Snake {
    constructor(select, finish, pop, obstacleMgr, itemMgr, particleEngine, audioMgr) {
        this.gameMap = document.querySelector(select);
        this.obstacleManager = obstacleMgr;
        this.itemManager = itemMgr;
        this.particleEngine = particleEngine;
        this.audioManager = audioMgr;

        this.direction = 'right';
        this.nextDirection = 'right'; // 缓冲输入，防止一帧内按反方向导致自杀
        this.snakeList = [];
        
        this.finishBtn = document.querySelector(finish);
        this.popLayer = document.querySelector(pop);
        
        // 状态效果
        this.activeEffects = [];

        this.initSnake();
    }

    initSnake() {
        // 清理旧蛇
        this.snakeList.forEach(el => el.remove());
        this.snakeList = [];
        this.direction = 'right';
        this.nextDirection = 'right';
        this.activeEffects = [];

        // 初始长度为4
        for (let i = 0; i < 4; i++) {
            this.createHead(true, 100 - i * 20, 100);
        }
    }

    // forceInit 用于初始化指定坐标
    createHead(forceInit = false, initX = 0, initY = 0) {
        const pos = { x: initX, y: initY };
        const head = this.snakeList[0];

        if (!forceInit && head) {
            // 更新实际方向
            this.direction = this.nextDirection;

            switch (this.direction) {
                case 'left':
                    pos.x = head.offsetLeft - CONSTANTS.CELL_SIZE;
                    pos.y = head.offsetTop;
                    break;
                case 'right':
                    pos.x = head.offsetLeft + CONSTANTS.CELL_SIZE;
                    pos.y = head.offsetTop;
                    break;
                case 'top':
                    pos.x = head.offsetLeft;
                    pos.y = head.offsetTop - CONSTANTS.CELL_SIZE;
                    break;
                case 'bottom':
                    pos.x = head.offsetLeft;
                    pos.y = head.offsetTop + CONSTANTS.CELL_SIZE;
                    break;
            }
            head.className = 'snake-body';
            head.style.zIndex = '1';
        }

        const div = document.createElement('div');
        div.className = 'snake-head';
        div.style.position = 'absolute';
        div.style.width = CONSTANTS.CELL_SIZE + 'px';
        div.style.height = CONSTANTS.CELL_SIZE + 'px';
        // 为了支持圆形或特效
        div.style.borderRadius = '4px';
        div.style.zIndex = '2';
        
        this.snakeList.unshift(div);
        div.style.left = pos.x + 'px';
        div.style.top = pos.y + 'px';
        this.gameMap.appendChild(div);
    }

    cutTail(count) {
        for(let i=0; i<count; i++) {
            if (this.snakeList.length > 3) { // 保持基础长度
                const tail = this.snakeList.pop();
                
                // 产生断尾粒子特效
                this.particleEngine.emit(tail.offsetLeft, tail.offsetTop, 5, '#ff4444');
                
                tail.remove();
            }
        }
    }

    move() {
        // 先检查移动前是否已经发生碰撞(理论上在上一帧就检查过了)
        
        // 移动机制：删除尾部，创建新头部
        const tail = this.snakeList.pop();
        tail.remove();
        this.createHead();
        
        // 移动后立刻检查死亡
        return this.checkDeath();
    }

    grow() {
        // 生长就是创建新头部而不删除尾部
        this.createHead();
    }

    // 独立的方法：不移除尾巴直接创建头部（用于吃食物）
    moveAndGrow() {
        this.createHead();
        return this.checkDeath();
    }

    checkDeath() {
        const head = this.snakeList[0];
        const headX = head.offsetLeft;
        const headY = head.offsetTop;

        // 1. 检查边界碰撞
        if (
            headX < 0 ||
            headX >= this.gameMap.offsetWidth ||
            headY < 0 ||
            headY >= this.gameMap.offsetHeight
        ) {
            this.handleDeath();
            return true;
        }

        // 2. 检查障碍物碰撞
        if (this.obstacleManager && this.obstacleManager.isObstacle(headX, headY)) {
            this.handleDeath();
            return true;
        }

        // 3. 检查自身碰撞 (从第4个节点开始查即可，因为前三个不可能回头撞到)
        for (let i = 3; i < this.snakeList.length; i++) {
            if (headX === this.snakeList[i].offsetLeft && headY === this.snakeList[i].offsetTop) {
                this.handleDeath();
                return true;
            }
        }

        return false;
    }

    handleDeath() {
        const head = this.snakeList[0];
        // 死亡粒子爆发
        this.particleEngine.emit(head.offsetLeft, head.offsetTop, 30, '#ff0000', 8, 10);
        this.audioManager.playSfx('die');
        
        // 显示结算弹窗
        if (this.popLayer) {
            this.popLayer.style.display = 'block';
            this.popLayer.style.zIndex = '100';
            
            // 确保弹窗里的按钮文字是“重新开始”
            if (this.finishBtn) {
                this.finishBtn.innerHTML = '重新开始';
            }
        }
    }

    closePop() {
        if (this.popLayer) {
            this.popLayer.style.display = 'none';
        }
    }

    // 修改方向，包含防回退逻辑
    changeDirection(newDir) {
        const opposites = {
            'top': 'bottom',
            'bottom': 'top',
            'left': 'right',
            'right': 'left'
        };
        
        // 基于当前实际移动方向判断，而不是 based on last input
        if (opposites[this.direction] !== newDir && this.direction !== newDir) {
            this.nextDirection = newDir;
        }
    }
}

// ==========================================
// 核心逻辑：游戏主控 (Game)
// ==========================================
class Game {
    constructor(select, score, finish, pop) {
        this.gameMap = document.querySelector(select);
        this.scoreDom = document.querySelector(score);
        
        // 实例化各子系统
        this.audioManager = new AudioManager();
        this.themeManager = new ThemeManager(this.gameMap);
        this.particleEngine = new ParticleEngine(this.gameMap);
        this.obstacleManager = new ObstacleManager(this.gameMap);
        this.itemManager = new ItemManager(this.gameMap, this.obstacleManager);
        this.leaderboard = new LeaderboardManager();
        
        this.snake = new Snake(select, finish, pop, this.obstacleManager, this.itemManager, this.particleEngine, this.audioManager);
        
        this.timer = null;
        this.count = 0; // 当前分数
        this.baseStep = CONSTANTS.FPS_DEFAULT; // 基础速度
        this.currentStep = this.baseStep; // 当前速度（可能受道具影响）
        
        this.isGameRunning = false;
        
        this.initUI();
    }

    initUI() {
        // 更新历史最高分显示
        let hsDom = document.querySelector('.high-score');
        if (!hsDom) {
            const scorePanel = document.querySelector('.score');
            if (scorePanel) {
                const hsDiv = document.createElement('div');
                hsDiv.innerHTML = `历史最高：<span class="high-score">${this.leaderboard.getHighScore()}</span>`;
                scorePanel.appendChild(hsDiv);
            }
        } else {
            hsDom.innerHTML = this.leaderboard.getHighScore();
        }

        // 添加主题切换按钮和音效切换按钮面板
        this.buildExtendedMenu();
    }

    buildExtendedMenu() {
        const btnBox = document.querySelector('.btn-box > div');
        if (btnBox && !document.querySelector('.bg-btn')) {
            // 换背景按钮
            const bgBtn = document.createElement('button');
            bgBtn.className = 'bg-btn';
            bgBtn.innerHTML = '换背景';
            bgBtn.onclick = (e) => { e.target.blur(); this.themeManager.nextBackground(); };
            btnBox.appendChild(bgBtn);

            // 换蛇皮按钮
            const skinBtn = document.createElement('button');
            skinBtn.className = 'skin-btn';
            skinBtn.innerHTML = '换蛇皮';
            skinBtn.onclick = (e) => { e.target.blur(); this.themeManager.nextSkin(); };
            btnBox.appendChild(skinBtn);

            // 静音按钮
            const muteBtn = document.createElement('button');
            muteBtn.className = 'mute-btn';
            muteBtn.innerHTML = this.audioManager.isMuted ? '开启音效' : '静音';
            muteBtn.onclick = (e) => { 
                e.target.blur(); 
                const muted = this.audioManager.toggleMute();
                muteBtn.innerHTML = muted ? '开启音效' : '静音';
            };
            btnBox.appendChild(muteBtn);

            // 切歌按钮
            const bgmBtn = document.createElement('button');
            bgmBtn.className = 'bgm-btn';
            bgmBtn.innerHTML = '切歌';
            bgmBtn.onclick = (e) => { e.target.blur(); this.audioManager.nextBgm(); };
            btnBox.appendChild(bgmBtn);
        }
    }

    reset() {
        this.pause();
        this.gameMap.innerHTML = ''; // 清空地图上的所有元素
        this.themeManager.drawGrid(); // 重新画网格
        
        this.count = 0;
        this.scoreRender(0); // 渲染0分
        
        if (this.speedRestoreTimer) {
            clearTimeout(this.speedRestoreTimer);
            this.speedRestoreTimer = null;
        }
        this.currentStep = this.baseStep;
        
        this.particleEngine.stop();
        this.obstacleManager.clear();
        this.itemManager.clear();
        
        // 可以选择性生成障碍物（提高难度）
        if (this.baseStep <= CONSTANTS.FPS_HARD) {
            this.obstacleManager.generateRandom(10, {x:0, y:0, w:6, h:6});
        }
        
        this.snake.initSnake();
        this.snake.closePop();
        
        this.itemManager.update(); // 生成第一个食物
        
        this.isGameRunning = false;
    }

    start() {
        if (this.isGameRunning) return;
        
        // 如果是重新开始后的首次启动
        if (this.snake.snakeList.length === 0) {
            this.reset();
        }

        this.leaderboard.recordGameStart();
        this.audioManager.initSfx(); // 尝试初始化音频上下文
        this.audioManager.playBgm();
        this.isGameRunning = true;
        this.runLoop();
    }

    runLoop() {
        // 使用 setTimeout 而不是 setInterval，以便动态改变速度 (例如吃加速道具)
        if (!this.isGameRunning) return;

        this.timer = setTimeout(() => {
            if (!this.isGameRunning) return;

            // 1. 获取蛇头即将移动到的位置
            const head = this.snake.snakeList[0];
            let nextX = head.offsetLeft;
            let nextY = head.offsetTop;
            
            switch (this.snake.nextDirection) {
                case 'left': nextX -= CONSTANTS.CELL_SIZE; break;
                case 'right': nextX += CONSTANTS.CELL_SIZE; break;
                case 'top': nextY -= CONSTANTS.CELL_SIZE; break;
                case 'bottom': nextY += CONSTANTS.CELL_SIZE; break;
            }

            // 2. 检查在这个位置上是否有道具
            const itemType = this.itemManager.checkCollision(nextX, nextY);
            
            let isDead = false;

            if (itemType) {
                // 吃到东西了
                this.handleItemEffect(itemType, nextX, nextY);
                isDead = this.snake.moveAndGrow();
            } else {
                // 没吃到东西，正常移动
                isDead = this.snake.move();
            }

            // 3. 更新道具系统（可能产生新道具）
            this.itemManager.update();

            // 4. 判定生死与循环
            if (isDead) {
                this.gameOver();
            } else {
                this.runLoop();
            }

        }, this.currentStep);
    }

    handleItemEffect(itemType, x, y) {
        this.leaderboard.recordFood();
        
        switch (itemType.type) {
            case 'NORMAL':
                this.scoreRender(itemType.score);
                this.audioManager.playSfx('eat');
                this.particleEngine.emit(x, y, 10, itemType.color);
                break;
            case 'DOUBLE':
                this.scoreRender(itemType.score);
                this.audioManager.playSfx('powerup');
                this.particleEngine.emit(x, y, 20, itemType.color, 8);
                break;
            case 'SPEED':
                this.scoreRender(itemType.score);
                this.audioManager.playSfx('powerup');
                this.applyTemporarySpeed(0.5, itemType.duration); // 速度加快一倍
                this.particleEngine.emit(x, y, 15, itemType.color);
                break;
            case 'POISON':
                this.scoreRender(itemType.score);
                this.audioManager.playSfx('poison');
                this.applyTemporarySpeed(2.0, itemType.duration); // 速度减慢一倍
                this.particleEngine.emit(x, y, 15, itemType.color);
                break;
            case 'SCISSORS':
                this.scoreRender(itemType.score);
                this.audioManager.playSfx('eat');
                this.snake.cutTail(2); // 剪掉两节尾巴
                this.particleEngine.emit(x, y, 20, itemType.color);
                break;
        }
    }

    applyTemporarySpeed(multiplier, duration) {
        // 恢复原始速度的定时器
        if (this.speedRestoreTimer) {
            clearTimeout(this.speedRestoreTimer);
        }
        
        this.currentStep = Math.max(50, this.baseStep * multiplier); // 最快 50ms
        
        this.speedRestoreTimer = setTimeout(() => {
            this.currentStep = this.baseStep;
            this.speedRestoreTimer = null;
        }, duration);
    }

    pause() {
        this.isGameRunning = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.audioManager.pauseBgm();
    }

    gameOver() {
        this.isGameRunning = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.audioManager.pauseBgm();
        
        // 记录排行榜
        this.leaderboard.recordGameOver(this.count);
        
        // 更新弹窗内容为简单的“游戏结束”
        const popLayer = document.querySelector('.pop-layer');
        if (popLayer) {
            let titleDom = popLayer.querySelector('span');
            if (titleDom) {
                titleDom.innerHTML = '游戏结束';
            }
            // 移除动态生成的分数显示（如果有的话）
            let scoreDisplay = popLayer.querySelector('.final-score-display');
            if (scoreDisplay) {
                scoreDisplay.remove();
            }
        }
        
        // 更新界面上的历史最高
        let hsDom = document.querySelector('.high-score');
        if (hsDom) {
            hsDom.innerHTML = this.leaderboard.getHighScore();
        }
    }

    // 重新开始
    restart() {
        this.reset();
        this.start();
    }

    change(type) {
        this.snake.changeDirection(type);
    }

    scoreRender(addValue) {
        this.count += addValue;
        if (this.count < 0) this.count = 0; // 分数不为负
        this.scoreDom.innerHTML = this.count;
        
        // 动态加速逻辑：每得1分，基础循环时间减少 2 毫秒，也就是速度稍微加快一点点
        // 设定一个极限速度（比如 60 毫秒），防止快到完全无法控制
        if (addValue > 0) {
            const speedDecrease = addValue * 2;
            const limitSpeed = 60; // 极限最快速度
            
            // 只有当前基础速度大于极限速度时才进行加速
            if (this.baseStep > limitSpeed) {
                this.baseStep = Math.max(limitSpeed, this.baseStep - speedDecrease);
                
                // 如果当前没有处于特殊道具（加速/减速）效果中，立即将当前速度同步为基础速度
                if (!this.speedRestoreTimer) {
                    this.currentStep = this.baseStep;
                }
            }
        }
        
        // 添加分数跳动动效
        this.scoreDom.style.transform = 'scale(1.5)';
        this.scoreDom.style.color = '#ff4e00';
        setTimeout(() => {
            this.scoreDom.style.transform = 'scale(1)';
            this.scoreDom.style.color = '#770e1c';
        }, 200);
    }
}

// ==========================================
// 初始化逻辑 (Initialization)
// ==========================================
window.addEventListener('load', function () {
    const gameMapDom = document.querySelector('.game-map');
    if (!gameMapDom) return;

    // 添加一些额外的 CSS 支持特效
    const style = document.createElement('style');
    style.innerHTML = `
        .score span { transition: all 0.2s ease-out; display: inline-block; }
        .btn-box button { margin-bottom: 10px; width: 100%; }
        .obstacle { z-index: 5; }
        .special-food { animation: pulse 1s infinite alternate; }
        @keyframes pulse {
            0% { transform: scale(0.9); box-shadow: 0 0 5px currentColor; }
            100% { transform: scale(1.1); box-shadow: 0 0 15px currentColor; }
        }
    `;
    document.head.appendChild(style);

    const game = new Game('.game-map', '.count', '.finish', '.pop-layer');

    const startBtn = document.querySelector('.start');
    const pauseBtn = document.querySelector('.pause');
    const restartBtn = document.querySelector('.restart');
    const finishBtn = document.querySelector('.finish');
    const gradeDom = document.querySelector('.grade');

    if (finishBtn) {
        finishBtn.addEventListener('click', function () {
            game.snake.closePop();
            game.restart();
        });
    }

    const options = document.querySelectorAll('.select>li');
    // 修改原 HTML 里的天地人为高中低
    if (options.length >= 3) {
        options[0].innerHTML = '高';
        options[1].innerHTML = '中';
        options[2].innerHTML = '低';
    }
    if (gradeDom && gradeDom.innerHTML === '人') {
        gradeDom.innerHTML = '低';
    }

    options.forEach(item => {
        item.addEventListener('click', function () {
            // 切换难度时重置游戏
            let newStep = CONSTANTS.FPS_DEFAULT;
            switch (item.innerHTML) {
                case '高': newStep = CONSTANTS.FPS_HARD; if(gradeDom) gradeDom.innerHTML = '高'; break;
                case '中': newStep = CONSTANTS.FPS_NORMAL; if(gradeDom) gradeDom.innerHTML = '中'; break;
                case '低': newStep = CONSTANTS.FPS_EASY; if(gradeDom) gradeDom.innerHTML = '低'; break;
            }
            game.baseStep = newStep;
            game.currentStep = newStep;
            game.reset(); // 重置以应用新难度（特别是可能产生的障碍物）
        });
    });

    // 按钮事件绑定
    if (startBtn) {
        startBtn.addEventListener('click', function (e) {
            e.target.blur();
            game.start();
        });
    }
    if (pauseBtn) {
        pauseBtn.addEventListener('click', function (e) {
            e.target.blur();
            if (game.isGameRunning) {
                game.pause();
                pauseBtn.innerHTML = '继续';
            } else {
                game.start();
                pauseBtn.innerHTML = '暂停';
            }
        });
    }
    if (restartBtn) {
        restartBtn.addEventListener('click', function (e) {
            e.target.blur();
            game.restart();
            if(pauseBtn) pauseBtn.innerHTML = '暂停';
        });
    }

    // 键盘事件绑定
    document.addEventListener('keydown', function (e) {
        const keyArr = [13, 32, 37, 38, 39, 40, 87, 65, 68, 83];
        
        // 阻止默认滚动
        if (keyArr.includes(e.keyCode)) {
            const gameRect = gameMapDom.getBoundingClientRect();
            const inView = (
                gameRect.top >= -200 &&
                gameRect.bottom <= (window.innerHeight || document.documentElement.clientHeight) + 200
            );
            if (inView) {
                e.preventDefault();
            }
        }

        if (e.keyCode === 13) {
            // 回车开始/重启
            if (!game.isGameRunning) {
                game.start();
                if(pauseBtn) pauseBtn.innerHTML = '暂停';
            }
        }
        else if (e.keyCode === 32) {
            // 空格暂停/继续
            if (game.isGameRunning) {
                game.pause();
                if(pauseBtn) pauseBtn.innerHTML = '继续';
            } else {
                // 如果游戏还没死，只是暂停状态，则继续
                if (game.snake.snakeList.length > 0 && popLayer.style.display !== 'block') {
                    game.start();
                    if(pauseBtn) pauseBtn.innerHTML = '暂停';
                }
            }
        }
        
        if (!game.isGameRunning) return;
        
        const popLayer = document.querySelector('.pop-layer');
        if (popLayer && popLayer.style.display === 'block') return; // 死亡期间不响应方向键

        if (e.keyCode === 38 || e.keyCode === 87) {
            game.change('top');
        } else if (e.keyCode === 37 || e.keyCode === 65) {
            game.change('left');
        } else if (e.keyCode === 39 || e.keyCode === 68) {
            game.change('right');
        } else if (e.keyCode === 40 || e.keyCode === 83) {
            game.change('bottom');
        }
    }, { passive: false });

    // 注入底部游戏说明面板
    const gameContainer = document.querySelector('.snake-game-container') || gameMapDom.parentElement;
    const infoPanel = document.createElement('div');
    infoPanel.className = 'game-info-panel';
    infoPanel.innerHTML = `
        <div class="info-section">
            <h4>🎮 快捷键说明</h4>
            <p><code>Enter</code> 开始/重玩 &nbsp;|&nbsp; <code>Space</code> 暂停/继续 &nbsp;|&nbsp; <code>W/A/S/D</code> 或 <code>方向键</code> 控制移动</p>
        </div>
        <div class="info-section">
            <h4>🍎 道具说明 (鼠标悬停查看)</h4>
            <div class="props-list">
                <span title="普通食物：+1分" class="prop-item" style="background:#a7fa64;"></span>
                <span title="双倍星星：+2分" class="prop-item" style="background:#ffd700;">🌟</span>
                <span title="加速药水：+1分，接下来的5秒内速度大幅提升！" class="prop-item" style="background:#00ffff;">⚡</span>
                <span title="致命毒药：-1分，接下来的5秒内速度大幅变慢，影响节奏！" class="prop-item" style="background:#a020f0;">💀</span>
                <span title="锋利剪刀：+1分，剪断你尾巴的最后两节！" class="prop-item" style="background:#ff4444;">✂️</span>
            </div>
        </div>
    `;

    // 注入面板相关的CSS
    const panelStyle = document.createElement('style');
    panelStyle.innerHTML = `
        .game-info-panel {
            background: rgba(0, 0, 0, 0.6);
            color: #fff;
            padding: 15px 20px;
            border-radius: 8px;
            margin-top: 15px;
            display: flex;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 20px;
            font-size: 14px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.1);
        }
        .info-section h4 { margin: 0 0 8px 0; color: #ffc369; font-size: 15px; }
        .info-section p { margin: 0; color: #ccc; }
        .info-section code { 
            background: #444; padding: 2px 6px; border-radius: 4px; color: #fff; 
            font-family: monospace; border: 1px solid #666;
        }
        .props-list { display: flex; gap: 12px; }
        .prop-item {
            width: 24px; height: 24px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 14px; cursor: help; transition: transform 0.2s;
            box-shadow: 0 2px 4px rgba(0,0,0,0.4);
        }
        .prop-item:hover { transform: scale(1.3); }
    `;
    document.head.appendChild(panelStyle);
    
    // 将说明面板放在整个游戏盒子的最下方
    if (gameContainer.nextSibling) {
        gameContainer.parentNode.insertBefore(infoPanel, gameContainer.nextSibling);
    } else {
        gameContainer.parentNode.appendChild(infoPanel);
    }

    // 初始化时先重置一下界面
    game.reset();
});
