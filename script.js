const SIZE = 8;
let board = [];
let current = 1; // 1=黑先

const boardEl = document.getElementById('board');
const currentPlayerEl = document.getElementById('currentPlayer');
const blackScoreEl = document.getElementById('blackScore');
const whiteScoreEl = document.getElementById('whiteScore');
const restartBtn = document.getElementById('restartBtn');

/* =======================
   AI 設定
======================= */
let vsAI = true;     
let aiPlayer = 2;    
let aiLevel = 'basic';

const DIRS = [
    [-1,-1],[-1,0],[-1,1],
    [0,-1],       [0,1],
    [1,-1],[1,0],[1,1]
];

/* =======================
   初始化棋盤
======================= */
function initBoard() {
    board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
    const m = SIZE / 2;
    board[m-1][m-1] = 2;
    board[m][m] = 2;
    board[m-1][m] = 1;
    board[m][m-1] = 1;
    current = 1;
    render();
}

function within(r, c) { return r>=0 && r<SIZE && c>=0 && c<SIZE; }

/* =======================
   計算翻棋
======================= */
function flipsForMove(r, c, player) {
    if(board[r][c]!==0) return [];
    const opponent = player===1?2:1;
    let toFlip = [];
    for(const [dr,dc] of DIRS){
        let rr=r+dr, cc=c+dc;
        const line=[];
        while(within(rr,cc)&&board[rr][cc]===opponent){
            line.push([rr,cc]);
            rr+=dr; cc+=dc;
        }
        if(line.length>0 && within(rr,cc)&&board[rr][cc]===player){
            toFlip = toFlip.concat(line);
        }
    }
    return toFlip;
}

function getLegalMoves(player){
    const moves = new Map();
    for(let r=0;r<SIZE;r++){
        for(let c=0;c<SIZE;c++){
            const flips = flipsForMove(r,c,player);
            if(flips.length>0) moves.set(`${r},${c}`, flips);
        }
    }
    return moves;
}

/* =======================
   下棋 & 翻棋動畫
======================= */
async function placeMove(r, c, player, flips) {
    board[r][c] = player;
    render();

    // 逐格點亮即將翻轉的棋子
    for (let i = 0; i < flips.length; i++) {
        const [fr, fc] = flips[i];
        const cell = document.querySelector(`.cell[data-r="${fr}"][data-c="${fc}"]`);
        if (cell) cell.classList.add('highlight'); 
        await delay(100); // 每格高亮間隔 100ms
    }

    // 翻棋動畫
    await flipSequential(flips, player);

    // 移除 highlight
    flips.forEach(([fr, fc]) => {
        const cell = document.querySelector(`.cell[data-r="${fr}"][data-c="${fc}"]`);
        if (cell) cell.classList.remove('highlight');
    });
}

function flipSequential(flips, player, delay=300){
    return new Promise(resolve => {
        if (flips.length === 0) { resolve(); return; }
        flips.forEach(([r, c], index) => {
            setTimeout(() => {
                const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
                if (!cell) return;
                const piece = cell.querySelector('.piece');
                if (!piece) return;
                piece.classList.add('flip');
                setTimeout(() => {
                    piece.classList.remove('black','white','flip');
                    piece.classList.add(player===1?'black':'white');
                    board[r][c] = player;
                    if (index === flips.length - 1) resolve();
                }, 400);
            }, delay * index);
        });
    });
}

/* =======================
   計算分數
======================= */
function computeScore(){
    let b=0,w=0;
    for(let r=0;r<SIZE;r++){
        for(let c=0;c<SIZE;c++){
            if(board[r][c]===1) b++;
            if(board[r][c]===2) w++;
        }
    }
    return {b,w};
}

/* =======================
   渲染棋盤
======================= */
function render() {
    boardEl.innerHTML = '';
    const moves = getLegalMoves(current);
    const moveKeys = Array.from(moves.keys());

    for (let r=0; r<SIZE; r++) {
        for (let c=0; c<SIZE; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.r = r;
            cell.dataset.c = c;
            const val = board[r][c];
            if(val!==0){
                const piece = document.createElement('div');
                piece.classList.add('piece', val===1?'black':'white');
                cell.appendChild(piece);
            } else {
                cell.classList.add('empty');
            }
            boardEl.appendChild(cell);
        }
    }

    // 玩家可下格子提示
    if (current !== aiPlayer) {
        moveKeys.forEach((key, index) => {
            const [r, c] = key.split(',').map(Number);
            const cell = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
            setTimeout(() => {
                cell.classList.add('possible');
                cell.addEventListener('click', () => onCellClick(r, c, moves.get(key)));
            }, 100 * index);
        });
    }

    const scores = computeScore();
    blackScoreEl.textContent = scores.b;
    whiteScoreEl.textContent = scores.w;
    currentPlayerEl.textContent = current===1?'黑':'白';

    checkForEndOrPass();
}

/* =======================
   玩家操作
======================= */
async function onCellClick(r, c, flips){
    if(current===aiPlayer) return;

    // 玩家下棋
    await placeMove(r, c, current, flips);

    // 換到 AI
    if(vsAI){
        current = aiPlayer;
        render();

        // 等玩家翻棋完成再延遲 1 秒
        await delay(1000);

        await aiMove();
        current = 1;
        render();
    } else {
        current = current===1?2:1;
        render();
    }
}

/* =======================
   AI 行為
======================= */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function aiMove() {
    const moves = getLegalMoves(aiPlayer);
    if (moves.size === 0) return;

    let move;
    if(aiLevel==='basic') move=chooseMoveBasic(moves);
    else move=chooseMoveAdvanced(moves);

    const [r,c] = move;
    await placeMove(r,c,aiPlayer,moves.get(`${r},${c}`));
}

function chooseMoveBasic(moves){
    const keys=Array.from(moves.keys());
    return keys[Math.floor(Math.random()*keys.length)].split(',').map(Number);
}

function chooseMoveAdvanced(moves){
    let bestKey=null, max=-1;
    for(const [key,flips] of moves){
        if(flips.length>max){
            max=flips.length;
            bestKey=key;
        }
    }
    return bestKey.split(',').map(Number);
}

/* =======================
   判斷結束或跳過
======================= */
function checkForEndOrPass(){
    if(getLegalMoves(current).size>0) return;
    const other = current===1?2:1;
    if(getLegalMoves(other).size>0){
        current = other;
        render();
        return;
    }
    const s = computeScore();
    alert(`遊戲結束 黑:${s.b} 白:${s.w}`);
}

/* =======================
   重新開始
======================= */
restartBtn.addEventListener('click',initBoard);

initBoard();
