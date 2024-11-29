const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 遊戲配置
const BLOCK_SIZE = 30; // 方塊大小
const BOARD_WIDTH = 12; // 遊戲區域寬度
const BOARD_HEIGHT = 20+2; // 遊戲區域高度

// 遊戲狀態變數
let board = [];             // 遊戲區域
let gameInterval = null;    // 遊戲間隔
let timerInterval;          // timer計時器
let lastPieceTime = 0;      // 上一次生成方塊的時間

let pieceList = [];         // 當前alive的方塊
let currentPiece = null;    // 當前方塊
let selectedPiece = null;   // 被選擇的方塊
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
        [1, 1, 1],
        [0, 0, 1],
        [1, 1, 1],
        [1, 0, 0],
        [1, 1, 1]
    ],
    '0': [
        [1, 1, 1],
        [1, 0, 1],
        [1, 0, 1],
        [1, 0, 1],
        [1, 1, 1]
    ],
    '4': [
        [1, 0, 1],
        [1, 0, 1],
        [1, 1, 1],
        [0, 0, 1],
        [0, 0, 1]
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
    draw(ctx) {
        for (let row = 0; row < this.shape.length; row++) {
            for (let col = 0; col < this.shape[row].length; col++) {
                if (this.shape[row][col]) {
                    const blockX = (this.x + col) * BLOCK_SIZE;
                    const blockY = (this.y + row) * BLOCK_SIZE;

                    // 為當前方塊生成漸變
                    const gradient = ctx.createLinearGradient(
                        blockX, blockY, 
                        blockX + BLOCK_SIZE, blockY + BLOCK_SIZE
                    );
                    gradient.addColorStop(0, this.colors[0]);
                    gradient.addColorStop(0.5, this.colors[1]);
                    gradient.addColorStop(1, this.colors[2]);

                    // 填充漸變
                    ctx.fillStyle = gradient;
                    ctx.fillRect(blockX, blockY, BLOCK_SIZE, BLOCK_SIZE);

                    // 繪製邊框
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = 'grey';
                    ctx.strokeRect(blockX, blockY, BLOCK_SIZE, BLOCK_SIZE);
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
    // 長條方塊的初始位置
    if(shapeIndex == 0) newPiece.y = 1;
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

/*---------------------------- 繪製功能 ---------------------------------*/
// 繪製網格線
function drawLines() {
    ctx.lineWidth = 1;  // 設置線條寬度
    ctx.strokeStyle = 'grey';  // 設置線條顏色
    // 繪製垂直線
    for (let x = 0; x <= BLOCK_SIZE*BOARD_WIDTH; x += BLOCK_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 2*BLOCK_SIZE);
        ctx.lineTo(x, BLOCK_SIZE*BOARD_HEIGHT);
        ctx.stroke();
    }

    // 繪製水平線
    for (let y = 2*BLOCK_SIZE; y <= BLOCK_SIZE*BOARD_HEIGHT ; y += BLOCK_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(BLOCK_SIZE*BOARD_WIDTH, y);
        ctx.stroke();
    }
}

// 繪製死方塊
function drawDeadBlocks() {
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
                ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
            }
        });
    });
}

// 繪製當前所有alive的方塊
function drawPieces(pieceList) {
    if(pieceList[0] != null){
        pieceList.forEach((piece) => {
            piece.draw(ctx);
            // 如果方塊的狀態是 selected，添加紅色粗體邊框
            if (piece.state == State.selected) {
                ctx.strokeStyle = 'red';  // 設置邊框顏色
                // 畫出選中方塊的紅色邊框，並將邊框的位置向外偏移
                ctx.strokeRect(
                    piece.x * BLOCK_SIZE - 2,  // 向左偏移2像素
                    piece.y * BLOCK_SIZE - 2,  // 向上偏移2像素
                    BLOCK_SIZE * piece.shape[0].length + 4,  // 增加4像素的寬度
                    BLOCK_SIZE * piece.shape.length + 4   // 增加4像素的高度
                );
            }
            if(piece.isCurrent) {
                landingPiece = new TetrisPiece(piece.shape);
                landingPiece.colors = piece.colors;
                landingPiece.x = piece.x;
                landingPiece.y = piece.y;
                while (landingPiece.canMove(0,1)){
                    landingPiece.y += 1;
                }
                ctx.globalAlpha = 0.25;
                landingPiece.draw(ctx)
                ctx.globalAlpha = 1;    // 恢復透明度
            }
        });
    }
}

function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // 清除畫布
    

    drawLines();
    drawDeadBlocks();
    drawPieces(pieceList);
}
/*----------------------------檢查功能---------------------------------*/
// 檢查是否遊戲結束
function checkGameOver(posY) {
    // 死亡方块超出天花板
    return (posY<2)? true:false;
}

function changeCurrent(index) {
    if (index != currentPiece_index) return;

    // 如果還有方塊，將下一個方塊設為當前方塊
    if (index == currentPiece_index && pieceList.length > currentPiece_index+1) {
        currentPiece_index++;
        currentPiece = pieceList[currentPiece_index];
        currentPiece.isCurrent = true;
        console.log(currentPiece_index);
    } else {
        currentPiece = null;  // 如果沒有更多方塊
    }
}

// 檢查是否與其他方塊重疊
function checkOverlap(piece) {
    for (let other of pieceList) {
        if (other === piece || other.state !== State.alive) continue;

        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[0].length; x++) {
                if (!piece.shape[y][x]) continue;

                const globalX = piece.x + x;
                const globalY = piece.y + y;

                for (let py = 0; py < other.shape.length; py++) {
                    for (let px = 0; px < other.shape[0].length; px++) {
                        if (!other.shape[py][px]) continue;

                        if (globalX === other.x + px && globalY === other.y + py) {
                            return true;
                        }
                    }
                }
            }
        }
    }
    return false;
}

/*----------------------------游戲循環---------------------------------*/
function mergePiece(piece) {
    piece.state = State.dead;
    piece.isCurrent = false;
    
    piece.shape.forEach((row, dy) => {
        row.forEach((cell, dx) => {
            if (cell) {
                const posY = piece.y + dy;
                const posX = piece.x + dx;
                // 使用物件形式來存儲顏色
                board[posY][posX] = { colors: piece.colors };
                // 如果方块超出天花板，直接结束游戏
                if (checkGameOver(posY)) {
                    drawBoard();
                    endGame();
                    return;
                }
            }
        });
    });
    const index = pieceList.indexOf(piece);
    changeCurrent(index);
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
        document.getElementById('startBtn').textContent = 'Playing';
    }
    
    // step1：將不能移動的方塊，先merge，并且丟入piecesToRemove
    pieceList.forEach((piece) => {
        if (!piece.canMove(0, 1)) {
            mergePiece(piece);
            piecesToRemove.push(piece);
        }
    });

    // step2：移動可以移動的方塊
    pieceList.forEach((piece, index) => {
        if (piece.canMove(0,1)) {
            piece.y++; // 移動方塊
        }
    });

    // step3:　清除已經無法移動的方塊，避免干擾
    // 循環結束所有方塊，才一次性刪除方塊(在循環中刪除元素會影響array的排序)
    // 例如pieceList[a,b,c,d]，當a不能繼續移動，
    // 然後被刪掉了pieceList[a,b,c]，可是index已經=1了，就會直接檢查b
    piecesToRemove.forEach((piece) => {
        const index = pieceList.indexOf(piece);
        if (index > -1) {
            // array.splice(index, num_delete, add item1,.....,add itemX)
            pieceList.splice(index, 1);  // 刪除方塊
        }
    });

    // step4：執行清行
    clearLines();
    
    // 更新currentPiece的index
    piecesToRemove = [];
    currentPiece_index = 0;
    drawBoard();
}

// 方塊拖動開始
function startDrag(event) {
    if (isGamePaused || isGameOver) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // 判斷鼠標是否點擊在某個方塊上
    for (let piece of pieceList) {
        if (piece.state !== State.alive) continue;

        const pieceStartX = piece.x * BLOCK_SIZE;
        const pieceStartY = piece.y * BLOCK_SIZE;
        const pieceEndX = pieceStartX + piece.shape[0].length * BLOCK_SIZE;
        const pieceEndY = pieceStartY + piece.shape.length * BLOCK_SIZE;

        if (mouseX >= pieceStartX && mouseX <= pieceEndX && mouseY >= pieceStartY && mouseY <= pieceEndY) {
            // 設置為選中狀態
            selectedPiece = piece;
            selectedPiece.state = State.selected;
            selectedPiece.offsetX = Math.floor(mouseX / BLOCK_SIZE) - selectedPiece.x;
            selectedPiece.offsetY = Math.floor(mouseY / BLOCK_SIZE) - selectedPiece.y;
            return;
        }
    }
}

// 拖動方塊
function drag(event) {
    if (!selectedPiece || isGamePaused || isGameOver) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    // 計算新的位置
    const newX = Math.floor(mouseX / BLOCK_SIZE) - selectedPiece.offsetX;
    const newY = Math.floor(mouseY / BLOCK_SIZE) - selectedPiece.offsetY;
    const oldX = selectedPiece.x;
    const oldY = selectedPiece.y;

    // 更新位置並檢查是否有效
    selectedPiece.x = newX;
    selectedPiece.y = newY;

    if (!selectedPiece.canMove(0, 0) || checkOverlap(selectedPiece)) {
        // 恢復舊位置
        selectedPiece.x = oldX;
        selectedPiece.y = oldY;
    }

    drawBoard();
}

// 拖動結束
function endDrag() {
    if (selectedPiece) {
        selectedPiece.state = State.alive;
        selectedPiece = null;
    }
}

// 更新分數
function updateScore() {
    document.getElementById('scorePanel').textContent = `Score: ${score}`; // 更新分數
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
/*---------------------------- 計時器 ---------------------------------*/
// 啓動計時器
function startTimer() {
    timerInterval = setInterval(updateTimer, 50); // 每50毫秒更新
}

// 分鐘和秒
function pad(number) {
    return number < 10 ? "0" + number : number;
}

// 毫秒
function padMilliseconds(number) {
    return number < 10 ? "00" + number : (number < 100 ? "0" + number : number);
}

// 更新計時器
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
        if ((minutes == 0 && seconds == 0 && milliseconds <= 65 ) || elapsedTime - lastPieceTime >= 4800) { // 每 5 秒才刷新一次
            createRandomPiece();
            lastPieceTime = elapsedTime; // 更新最後一次生成方塊的時間
        }
    }
}
/*----------------------------游戲按鈕---------------------------------*/
function startGame() {
    // 若游戲正在進行，點擊start button沒有作用
    if (!isGamePaused) return;

    clearInterval(gameInterval);
    isGamePaused = false;
    isGameOver = false;

    // 剛開始才需要創建新的方塊
    if (newGame == true){
        startGameWithCountdown();
    }
    else{
        let now = new Date().getTime();
        pausedTime += now- pausedStartTime;
        //gameLoop();     // 先立馬恢復游戲
        gameInterval = setInterval(gameLoop, 1000 / gameSpeed); // 開始遊戲循環
        startTimer();
        document.getElementById('startBtn').textContent = 'Playing';
    }
    
    document.getElementById('pauseBtn').textContent = 'll';
}

function pauseGame() {
    if (newGame) return;

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
    pieceList = [];
    currentPiece = null;
    currentPiece_index = 0;
    score = 0;
    gameSpeed = 1;
    isGamePaused = true;
    isGameOver = false;
    newGame = true;
    gameInterval = null;
    // 重置計時相關變數
    startTime = 0;
    pausedTime = 0;
    pauseStartTime = 0;
    lastRotateTime = 0;
    lastPieceTime = 0;
    shapeCount = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    document.getElementById('startBtn').textContent = '▶';
    document.getElementById('speedPanel').textContent = 'Speed: 1x';
    document.getElementById('timer').textContent ="00:00:000";
    drawBoard();

    startGame(); // 重新開始遊戲
}
/*----------------------------游戲動畫---------------------------------*/
// 游戲開始倒數畫面
function startGameWithCountdown() {
    const spaceBetween = 30;
    let introPieces = [];
    let countdownInterval = null;
    let animationInterval = null;
    let countdownValue = 3;

    // Create TetrisPiece for each number in 2024
    function createNumberPieces() {
        const numbers = ['2', '0', '2', '4'];
        introPieces = numbers.map((num, index) => {
            const piece = new TetrisPiece(numberMatrix[num]);
            // Position pieces off-screen to the right
            piece.x = BOARD_WIDTH + index * (piece.shape[0].length + spaceBetween / BLOCK_SIZE);
            piece.y = 4; // Vertical positioning
            return piece;
        });
    }

    function moveIntroAnimation() {
        introPieces.forEach(piece => {
            piece.x -= 1;
            if (piece.x + piece.shape[0].length < 0) {
                console.log("test");
                piece.x = BOARD_WIDTH + (piece.shape[0].length + spaceBetween / BLOCK_SIZE);
                // Randomize color when wrapping
                const newColorSet = colorList[Math.floor(Math.random() * colorList.length)];
                piece.colors = newColorSet;
            }
        });
        drawIntroBoard();
    }

    function drawIntroBoard() {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // 清除畫布
        
        drawLines();
        drawPieces(introPieces);
    }

    // Start game countdown
    function startCountdown() {
        document.getElementById('introScreen').style.display = 'flex';
        let countdownText = document.getElementById('countdownText');
        countdownText.innerText = countdownValue;

        countdownInterval = setInterval(() => {
            countdownValue--;
            countdownText.innerText = countdownValue;

            if (countdownValue < 0) {
                clearInterval(countdownInterval);
                clearInterval(animationInterval);
                
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                document.getElementById('introScreen').style.display = 'none';
                gameLoop();
                newGame = false;
            }
        }, 1000);
    }

    // Initialize and start intro animation
    function initIntroAnimation() {
        createNumberPieces();
        animationInterval = setInterval(moveIntroAnimation, 100);
        startCountdown();
    }

    initIntroAnimation();
}

function endGame() {
    isGameOver = true;
    clearInterval(gameInterval);
    clearInterval(timerInterval);
    
    const gameOverModal = document.getElementById('gameOverModal');
    const finalScoreEl = document.getElementById('finalScore');
    
    finalScoreEl.textContent = `Final Score: ${score}`;
    gameOverModal.style.display = 'flex'; // 顯示結束畫面
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
            break;
    }
    drawBoard();
});

// 滑鼠事件監聽
canvas.addEventListener('mousedown', startDrag);
canvas.addEventListener('mousemove', drag);
canvas.addEventListener('mouseup', endDrag);

// Initial setup
initializeBoard();
drawBoard();