const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 遊戲配置
const BLOCK_SIZE = 30; // 方塊大小
const BOARD_WIDTH = 12; // 遊戲區域寬度
const BOARD_HEIGHT = 20; // 遊戲區域高度

// 遊戲狀態變數
let board = [];             // 遊戲區域
let gameInterval = null;    // 遊戲間隔
let timerInterval;          // timer計時器
let lastPieceTime = 0;      // 上一次生成方塊的時間

let pieceList = [];
let currentPiece = null;    // 當前方塊
let currentPiece_index = 0; // 當前方塊
let score = 0;              // 分數
let gameSpeed = 1;          // 遊戲速度

let isGamePaused = true;    // 是否暫停遊戲
let isGameOver = false;     // 遊戲是否結束
let newGame = true;

let startTime = 0;          // 記錄開始的時間
let pausedTime = 0;         // 暫停期間累計的時間
let pausedStartTime = 0;    // 按暫停的時間
let lastRotateTime = 0;
const ROTATE_COOLDOWN = 100;

// 標準俄羅斯方塊
const SHAPES = [
    [[1,1,1,1]], // I 塊
    [[1,1],[1,1]], // 方塊
    [[1, 1, 1], [1, 0, 0]], // L
    [[1, 1, 1], [0, 0, 1]], // J
    [[0,1,1],[1,1,0]], // Z 塊
    [[1,1,0],[0,1,1]], // S 塊
    [[1,1,1],[0,1,0]]  // T 塊
];

// 2024
const numberMatrix = {
    '2': [
        [1, 1, 1, 1],
        [0, 0, 0, 1],
        [1, 1, 1, 1],
        [1, 0, 0, 0],
        [1, 1, 1, 1]
    ],
    '0': [
        [1, 1, 1, 1],
        [1, 0, 0, 1],
        [1, 0, 0, 1],
        [1, 0, 0, 1],
        [1, 1, 1, 1]
    ],
    '4': [
        [1, 0, 1, 0],
        [1, 0, 1, 0],
        [1, 1, 1, 1],
        [0, 0, 1, 0],
        [0, 0, 1, 0]
    ]
};

// 顏色配置
const colorList = [
    ['#FF7F7F', '#FFD700', '#ADFF2F'], // 漸變1：紅 -> 黃 -> 綠
    ['#87CEFA', '#6A5ACD', '#4B0082'], // 漸變2：淺藍 -> 紫 -> 靛藍
    ['#FF4500', '#FF6347', '#FFDAB9'], // 漸變3：橘紅 -> 粉紅 -> 淺黃
    ['#7FFFD4', '#40E0D0', '#1E90FF'],  // 漸變4：水藍 -> 青綠 -> 深藍
    ['#A6C0FE', '#f68084', '#FFF'],
    ['#fed6e3','#a8edea', '#FFF']
];

const State = Object.freeze({
    alive: 0,
    selected: 1,
    dead: 2
});

class TetrisPiece {
    constructor(shape) {
        this.shape = shape;
        // 隨機漸變顏色
        const colorSet = colorList[Math.floor(Math.random() * colorList.length)];
        this.colors = colorSet;
        this.state = State.alive;
        this.x = Math.floor((BOARD_WIDTH - shape[0].length) / 2);
        this.y = 0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isCurrent = false;
    }

    // 繪製方法
    draw(ctx, blockSize) {
        for (let row = 0; row < this.shape.length; row++) {
            for (let col = 0; col < this.shape[row].length; col++) {
                if (this.shape[row][col]) {
                    const blockX = (this.x + col) * blockSize;
                    const blockY = (this.y + row) * blockSize;

                    // 為當前方塊生成漸變
                    const gradient = ctx.createLinearGradient(
                        blockX, blockY, 
                        blockX + blockSize, blockY + blockSize
                    );
                    gradient.addColorStop(0, this.colors[0]);
                    gradient.addColorStop(0.5, this.colors[1]);
                    gradient.addColorStop(1, this.colors[2]);

                    // 填充漸變
                    ctx.fillStyle = gradient;
                    ctx.fillRect(blockX, blockY, blockSize, blockSize);

                    // 繪製邊框
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = 'black';
                    ctx.strokeRect(blockX, blockY, blockSize, blockSize);
                }
            }
        }
    }

    // 旋轉方法
    rotate() {
        // 避免快速旋轉導致畫面震動
        const currentTime = Date.now();
        if (currentTime - lastRotateTime >= ROTATE_COOLDOWN) {
            lastRotateTime = currentTime;
        }
        else return;
        // 取出所有行中第 i 列的元素，形成一個新行並reverse(旋轉90度)
        const rotated = this.shape[0].map((_, i) => 
            this.shape.map(row => row[i]).reverse()
        );

        const originalShape = this.shape;
        this.shape = rotated;

        // 如果旋轉後無法移動，則恢復原來的形狀
        if (!this.canMove(0, 0)) {
            this.shape = originalShape;
        }
        drawBoard();
    }

    // 移動檢查方法
    canMove(offsetX, offsetY) {
        for (let y = 0; y < this.shape.length; y++) {
            for (let x = 0; x < this.shape[y].length; x++) {
                if (!this.shape[y][x]) continue;
                
                const newX = this.x + x + offsetX;
                const newY = this.y + y + offsetY;
    
                if (newX < 0 || newX >= BOARD_WIDTH || 
                    newY >= BOARD_HEIGHT || 
                    (newY >= 0 && board[newY][newX])) {
                    return false;
                }
            }
        }
        return true;
    }

    // 點擊開始--判斷是否有點選到current方塊
    startDrag(event) {
        // 首先检查方块状态+当前方块才能被拖拽
        if (this.state != State.alive || !this.isCurrent) {
            return;
        }
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // 判斷鼠標是否在方塊內
        const pieceStartX = this.x * BLOCK_SIZE;
        const pieceStartY = this.y * BLOCK_SIZE;
        const pieceEndX = pieceStartX + this.shape[0].length * BLOCK_SIZE;
        const pieceEndY = pieceStartY + this.shape.length * BLOCK_SIZE;

        // 如果鼠標不在當前方塊範圍內
        if (mouseX < pieceStartX || mouseX > pieceEndX || mouseY < pieceStartY || mouseY > pieceEndY) {
            return;
        }
        
        this.state = State.selected;
        // 計算滑鼠點擊位置相對於方塊的偏移
        this.offsetX = Math.floor(mouseX / BLOCK_SIZE) - this.x;
        this.offsetY = Math.floor(mouseY / BLOCK_SIZE) - this.y;
    }

    // 拖拽移动方法
    drag(event) {
        if (this.state != State.selected) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // 计算新的方块位置
        const newX = Math.floor(mouseX / BLOCK_SIZE) - this.offsetX;
        const newY = Math.floor(mouseY / BLOCK_SIZE) - this.offsetY;

        // 先暂存旧位置
        const oldX = this.x;
        const oldY = this.y;

        // 更新方块位置
        this.x = newX;
        this.y = newY;

        // 检查是否可以移动
        if (!this.canMove(0, 0)) {
            // 如果不能移动，恢复旧位置
            this.x = oldX;
            this.y = oldY;
        }

        // 检查是否与其他活动方块重叠
        let isOverlap = false;
        for (let piece of pieceList) {
            // 排除当前方块自己进行重叠检查
            if (piece !== this && piece.state === State.alive) {
                // 遍历当前方块的每一格
                for (let y = 0; y < this.shape.length; y++) {
                    for (let x = 0; x < this.shape[0].length; x++) {
                        if (!this.shape[y][x]) continue; // 跳过空白部分

                        const globalX = newX + x;
                        const globalY = newY + y;

                        // 遍历其他方块的每一格
                        for (let py = 0; py < piece.shape.length; py++) {
                            for (let px = 0; px < piece.shape[0].length; px++) {
                                if (!piece.shape[py][px]) continue; // 跳过空白部分

                                // 如果有重叠，设置标志位并跳出
                                if (globalX === piece.x + px && globalY === piece.y + py) {
                                    //console.log("检测到重叠：", globalX, globalY, piece.x + px, piece.y + py); // 输出重叠位置
                                    isOverlap = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (isOverlap) break; // 已经找到重叠，跳出循环
                }
            }
            if (isOverlap) break; // 已经找到重叠，跳出循环
        }

        // 如果有重叠，恢复旧位置并显示提示
        if (isOverlap) {
            //console.log("有重叠"); // 调试用
            this.x = oldX;
            this.y = oldY;
        }

        // 绘制更新后的画布
        drawBoard();
    }

    // // 拖拽結束方法
    endDrag() {
        this.state = State.alive;
    }
}

/*----------------------------創建/畫物件---------------------------------*/
// 初始化游戲板
function initializeBoard() {
    board = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(0)); // 創建空白遊戲區域
}

// 儲存每個形狀出現的次數
let shapeCount = {
    0: 0, // I 塊
    1: 0, // 方塊
    2: 0, // L 塊
    3: 0, // J 塊
    4: 0, // Z 塊
    5: 0, // S 塊
    6: 0  // T 塊
};

function createRandomPiece() {
    // 找出可以被選擇的形狀索引
    let availableIndices = [];
    for (let i = 0; i < SHAPES.length; i++) {
        if (shapeCount[i] < 2) {
            availableIndices.push(i);  // 如果形狀出現少於兩次，則加入可用形狀列表
        }
    }

    // 如果沒有可用的形狀，重置計數並重新開始
    if (availableIndices.length === 0) {
        shapeCount = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
        availableIndices = [...Array(SHAPES.length).keys()]; // 重新填充所有形狀
    }

    // 隨機選擇一個形狀索引
    const shapeIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    const shape = SHAPES[shapeIndex];
    
    const newPiece = new TetrisPiece(shape);
    pieceList.push(newPiece);

    // 如果是第一個方塊，設為當前方塊
    if (currentPiece == null) {
        currentPiece = newPiece;
        currentPiece.isCurrent = true;
    }

    // 更新該形狀的計數
    shapeCount[shapeIndex]++;
    drawBoard(); // 更新畫面
}

function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // 清除畫布
    
    // 繪製背景
    ctx.fillStyle = '#606060';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 設置線條樣式，確保水平線和方塊的邊框一致
    ctx.lineWidth = 1;  // 設置線條寬度
    ctx.strokeStyle = 'black';  // 設置線條顏色
    // 繪製垂直線
    for (let x = 0; x <= canvas.width; x += BLOCK_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    // 繪製水平線
    for (let y = 0; y <= canvas.height; y += BLOCK_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // 繪製已經堆疊的方塊（死方塊）
    board.forEach((row, y) => {
        row.forEach((cell, x) => {
            if (cell && Array.isArray(cell.colors)) {
                const baseColor = cell.colors;
                const gradient = ctx.createLinearGradient(x * BLOCK_SIZE, y * BLOCK_SIZE, (x + 1) * BLOCK_SIZE, (y + 1) * BLOCK_SIZE);
                gradient.addColorStop(0, baseColor[0]);
                gradient.addColorStop(0.5, baseColor[1]);
                gradient.addColorStop(1, baseColor[2]);
                
                ctx.fillStyle = gradient;
                ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
                // 繪製每個死方塊的邊框
                ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1); 
            }
        });
    });

    // 繪製當前所有alive的方塊
    if(pieceList[0] != null){
        pieceList.forEach((piece) => {
            piece.draw(ctx, BLOCK_SIZE);
            // 如果方塊的狀態是 selected，添加紅色粗體邊框
            if (piece.isCurrent || piece.state == State.selected) {
                ctx.strokeStyle = 'red';  // 設置邊框顏色
                // 畫出選中方塊的紅色邊框，並將邊框的位置向外偏移
                ctx.strokeRect(
                    piece.x * BLOCK_SIZE - 2,  // 向左偏移2像素
                    piece.y * BLOCK_SIZE - 2,  // 向上偏移2像素
                    BLOCK_SIZE * piece.shape[0].length + 4,  // 增加4像素的寬度
                    BLOCK_SIZE * piece.shape.length + 4   // 增加4像素的高度
                );
            }
        });
    }
    requestAnimationFrame(drawBoard);
}

/*----------------------------檢查功能---------------------------------*/
function changeCurrent(index) {
    // 如果還有方塊，將下一個方塊設為當前方塊
    if (index == currentPiece_index && pieceList.length > currentPiece_index+1) {
        currentPiece_index++;
        currentPiece = pieceList[currentPiece_index];
        currentPiece.isCurrent = true;
        //console.log(currentPiece_index);
    } else {
        currentPiece = null;  // 如果沒有更多方塊
    }
}
function mergePiece(piece) {
    piece.state = State.dead;
    piece.isCurrent = false;
    
    piece.shape.forEach((row, dy) => {
        row.forEach((cell, dx) => {
            if (cell) {
                // 使用物件形式來存儲顏色
                board[piece.y + dy][piece.x + dx] = { colors: piece.colors }; // 儲存顏色數組
            }
        });
    });
    const index = pieceList.indexOf(piece);
    changeCurrent(index);
}

function checkGameOver() {
    return board[0].some(cell => cell !== 0); // 檢查是否遊戲結束
}

// 游戲循環
function gameLoop() {
    if (isGamePaused || isGameOver) return;
    
    let piecesToRemove = [];
    // 新游戲初始化
    if (gameInterval == null) {
        gameInterval = setInterval(gameLoop, 1000 / gameSpeed);
        startTimer();
        startTime = new Date().getTime();
        //createRandomPiece(); 
        document.getElementById('startBtn').textContent = 'Playing';
    }
    
    pieceList.forEach((piece) => {
        if (piece.canMove(0, 1)){
            piece.y++;
        }
        else{
            piecesToRemove.push(piece);
            mergePiece(piece);
            clearLines();
            if (checkGameOver()) {
                endGame();
                return;
            }
        }
    });

    // 一次性刪除方塊(在循環中刪除元素會影響array的排序)
    // 例如pieceList[a,b,c,d]，當a不能繼續移動，
    // 然後被刪掉了pieceList[a,b,c]，可是index已經=1了，就會直接檢查b
    piecesToRemove.forEach((piece) => {
        const index = pieceList.indexOf(piece);
        if (index > -1) {
            // array.splice(index, num_delete, add item1,.....,add itemX)
            pieceList.splice(index, 1);  // 刪除方塊
        }
    });
    // 更新currentPiece的index
    currentPiece_index = 0;
    drawBoard();
}

function clearLines() {
    let linesCleared = 0;
    
    for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
        if (board[y].every(cell => cell)) { // 檢查整行是否填滿
            board.splice(y, 1);
            board.unshift(Array(BOARD_WIDTH).fill(0)); // 清除填滿的行
            linesCleared++;
            y++;
            
            score += 100 * linesCleared; // 每清除一行，纍加分數
        }
    }
    updateScore();
}
// Start timer function
function startTimer() {
    timerInterval = setInterval(updateTimer, 50); // 每50毫秒更新
}

// Update the timer
function updateTimer() {
    let elapsedTime = new Date().getTime() - startTime - pausedTime; // 減去累計的暫停時間
    let minutes = Math.floor(elapsedTime / 60000);
    let seconds = Math.floor((elapsedTime % 60000) / 1000);
    let milliseconds = elapsedTime % 1000;

    // Format time: MM:SS:MS
    document.getElementById('timer').textContent = 
        pad(minutes) + ":" + pad(seconds) + ":" + padMilliseconds(milliseconds);

    // 每5秒產生新的方塊
    if (seconds % 5 == 0) {
        if ((seconds == 0 && milliseconds <= 90 ) || elapsedTime - lastPieceTime >= 4500) { // 每 5 秒才刷新一次
            createRandomPiece();
            lastPieceTime = elapsedTime; // 更新最後一次生成方塊的時間
        }
    }
}

// Pad single digit numbers with a leading zero
function pad(number) {
    return number < 10 ? "0" + number : number;
}

// Format milliseconds with three digits
function padMilliseconds(number) {
    return number < 10 ? "00" + number : (number < 100 ? "0" + number : number);
}

/*----------------------------進行游戲---------------------------------*/
// 游戲開始倒數畫面
function startGameWithCountdown() {
    const blockSize = 20;
    const spaceBetween = 10;
    let x = -200;
    let currentColorSet = colorList[Math.floor(Math.random() * colorList.length)];
    let animationFrameId; // 用于存储动画帧ID

    function drawNumber(matrix, xOffset, yOffset, color) {
        ctx.fillStyle = color;
        matrix.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (cell === 1) {
                    ctx.fillRect(xOffset + x * blockSize, yOffset + y * blockSize, blockSize, blockSize);
                }
            });
        });
    }

    function draw2024(x) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let currentX = x;
        const numbers = ['2', '0', '2', '4'];
        
        numbers.forEach((num, index) => {
            drawNumber(
                numberMatrix[num], 
                currentX, 
                150, 
                currentColorSet[index] || currentColorSet[0]
            );
            currentX += 5 * blockSize + spaceBetween;
        });
    }

    function animate_2024() {
        x += 5;

        if (x > canvas.width) {
            x = -200;
            currentColorSet = colorList[Math.floor(Math.random() * colorList.length)];
        }

        draw2024(x);
        animationFrameId = requestAnimationFrame(animate_2024);
    }

    let countdownValue = 3;
    let countdownInterval;
    
    // 顯示開場動畫
    document.getElementById('introScreen').style.display = 'flex';
    let countdownText = document.getElementById('countdownText');
    // 重置倒數值
    countdownText.innerText = countdownValue;

    // 启动2024动画
    x = -200; // 重置x位置
    animate_2024();

    // 设定倒数动画
    countdownInterval = setInterval(function() {
        countdownValue--;
        countdownText.innerText = countdownValue;

        if (countdownValue < 0) {
            clearInterval(countdownInterval);
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            document.getElementById('introScreen').style.display = 'none';
            gameLoop();
        }
    }, 1000);
}

function startGame() {
    // 若游戲正在進行，點擊start button沒有作用
    if (!isGamePaused) return;

    clearInterval(gameInterval);
    isGamePaused = false;
    isGameOver = false;

    // 剛開始才需要創建新的方塊
    if (newGame == true){
        newGame = false;
        startGameWithCountdown();
    }
    else{
        let now = new Date().getTime();
        pausedTime += now- pausedStartTime;
        
        gameInterval = setInterval(gameLoop, 1000 / gameSpeed); // 開始遊戲循環
        startTimer();
        document.getElementById('startBtn').textContent = 'Playing';
    }
    
    document.getElementById('pauseBtn').textContent = 'll';
}

function pauseGame() {
    if(!isGamePaused) {
        clearInterval(timerInterval);
        clearInterval(gameInterval); // 暂停游戏循环

        // 暫停的時間
        pausedStartTime = new Date().getTime();

        isGamePaused = true;
        document.getElementById('startBtn').textContent = '▶';
    }
    document.getElementById('pauseBtn').textContent = isGamePaused ? 'Resume' : 'll';
}

function restartGame() {
    gameOverModal.style.display = 'none'; // 隱藏結束畫面
    
    clearInterval(gameInterval);
    clearInterval(timerInterval);
    initializeBoard();
    score = 0;
    gameSpeed = 1;
    isGamePaused = true;
    isGameOver = false;
    newGame = true;
    currentPiece = null;
    gameInterval = null;
    // 重置計時相關變數
    pausedTime = 0;
    pauseStartTime = 0;
    pieceList = []
    lastPieceTime = 0;

    document.getElementById('startBtn').textContent = '▶';
    document.getElementById('speedPanel').textContent = 'Speed: 1x';
    document.getElementById('timer').textContent ="00:00:000";
    drawBoard();

    startGame(); // 重新開始遊戲
}

function endGame() {
    isGameOver = true;
    clearInterval(gameInterval);
    
    const gameOverModal = document.getElementById('gameOverModal');
    const finalScoreEl = document.getElementById('finalScore');
    
    finalScoreEl.textContent = `Final Score: ${score}`;
    gameOverModal.style.display = 'flex'; // 顯示結束畫面
}

// 更新分數
function updateScore() {
    document.getElementById('scorePanel').textContent = `Score: ${score}`; // 更新分數
}

/*----------------------------------操作----------------------------------*/
function moveLeft() {
    if (currentPiece.canMove(-1, 0) && !isGamePaused) currentPiece.x--;
    drawBoard();
}

function moveRight() {
    if (currentPiece.canMove(1, 0) && !isGamePaused) currentPiece.x++;
    drawBoard();
}

function rotatePiece() {
    if (!isGamePaused){
        currentPiece.rotate();
    }
}

function speedUp() {
    if (gameSpeed < 5) {
        gameSpeed++;
        clearInterval(gameInterval);
        gameInterval = setInterval(gameLoop, 1000 / gameSpeed);
        document.getElementById('speedPanel').textContent = `Speed: ${gameSpeed}x`;
    }
}

function speedDown() {
    if (gameSpeed > 1) {
        gameSpeed--;
        clearInterval(gameInterval);
        gameInterval = setInterval(gameLoop, 1000 / gameSpeed);
        document.getElementById('speedPanel').textContent = `Speed: ${gameSpeed}x`;
    }
}

// 键盘控制
document.addEventListener('keydown', (e) => {
    if (isGamePaused || isGameOver || !currentPiece) return;

    switch (e.code) {
        case 'ArrowLeft':
            if (currentPiece.canMove(-1, 0)) currentPiece.x--;
            break;
        case 'ArrowRight':
            if (currentPiece.canMove(1, 0)) currentPiece.x++;
            break;
        case 'ArrowDown':
            if (currentPiece.canMove(0, 1)) currentPiece.y++;
            break;
        case 'ArrowUp':
            rotatePiece();
            break;
        case 'Space': // 空格鍵快速下降
            while (currentPiece.canMove(0, 1)) {
                currentPiece.y++;
            }
            mergePiece(currentPiece);       // 將方塊固定到遊戲板
            clearLines();                   // 檢查是否有需要消除的行

            pieceList.splice(0, 1);         // 刪除方塊
            currentPiece_index = 0;         // 更新currentPiece的index

            if (checkGameOver()) {
                endGame(); // 遊戲結束
            }
            break;
    }
    drawBoard();
});

// 鼠標
canvas.addEventListener('mousedown', (event) => {
    if (currentPiece && !isGamePaused && !isGameOver) {
        currentPiece.startDrag(event);
    }
});

canvas.addEventListener('mousemove', (event) => {
    if (currentPiece && currentPiece.state == 1 && !isGamePaused && !isGameOver) {
        currentPiece.drag(event);
    }
});

canvas.addEventListener('mouseup', () => {
    if (currentPiece) {
        currentPiece.endDrag();
    }
});

// Initial setup
initializeBoard();
drawBoard();