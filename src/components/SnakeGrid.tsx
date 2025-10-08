"use client"
import React, {useEffect, useRef, useReducer, useCallback, useMemo, useState} from "react";

const GRID_SIZE = 20;
const INITIAL_SPEED = 150;
const SPEED_DECREASE_PER_LEVEL = 15;
const MIN_SPEED = 50;
const POINTS_PER_FOOD = 10;
const LEVEL_UP_THRESHOLD = 50;

type Point = { x: number; y: number };
type Direction = "up" | "down" | "left" | "right";

type GameState = {
    snake: Point[];
    food: Point;
    direction: Direction;
    gameOver: boolean;
    score: number;
    level: number;
    highScore: number;
    gameStartTime: number;
    movesCount: number;
    gameStarted: boolean;
};

type Action =
    | { type: "START" }
    | { type: "RESTART" }
    | { type: "MOVE"; dir: Direction }
    | { type: "GAME_OVER" }
    | { type: "SET_HIGH_SCORE" };

const initialSnake = [
    {y: 10, x: 12},
    {y: 10, x: 11},
    {y: 10, x: 10},
];

const generateFood = (snake: Point[]): Point => {
    let newFood: Point;
    do {
        newFood = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE),
        };
    } while (snake.some((p) => p.x === newFood.x && p.y === newFood.y));
    return newFood;
};

const reducer = (state: GameState, action: Action): GameState => {
    switch (action.type) {
        case "START": {
            return {
                ...state,
                gameStarted: true,
                gameStartTime: Date.now(),
            };
        }

        case "RESTART": {
            const newFood = generateFood(initialSnake);
            return {
                snake: initialSnake,
                food: newFood,
                direction: "right",
                gameOver: false,
                score: 0,
                level: 1,
                highScore: state.highScore,
                gameStartTime: Date.now(),
                movesCount: 0,
                gameStarted: true,
            };
        }

        case "SET_HIGH_SCORE": {
            const newHighScore = Math.max(state.highScore, state.score);
            try {
                localStorage.setItem("snakeHighScore", newHighScore.toString());
            } catch {
            }
            return {
                ...state,
                highScore: newHighScore,
            };
        }

        case "GAME_OVER": {
            return {
                ...state,
                gameOver: true,
            };
        }

        case "MOVE": {
            if (!state.gameStarted || state.gameOver) return state;

            const newSnake = [...state.snake];
            const head = {...newSnake[0]};

            switch (action.dir) {
                case "up":
                    head.y -= 1;
                    break;
                case "down":
                    head.y += 1;
                    break;
                case "left":
                    head.x -= 1;
                    break;
                case "right":
                    head.x += 1;
                    break;
            }

            if (
                head.x < 0 ||
                head.x >= GRID_SIZE ||
                head.y < 0 ||
                head.y >= GRID_SIZE ||
                newSnake.some((p) => p.x === head.x && p.y === head.y)
            ) {
                return {...state, gameOver: true};
            }

            newSnake.unshift(head);

            if (head.x === state.food.x && head.y === state.food.y) {
                const newScore = state.score + POINTS_PER_FOOD;
                const newLevel = Math.floor(newScore / LEVEL_UP_THRESHOLD) + 1;
                const newFood = generateFood(newSnake);

                return {
                    ...state,
                    snake: newSnake,
                    food: newFood,
                    score: newScore,
                    level: newLevel,
                    movesCount: state.movesCount + 1,
                };
            } else {
                newSnake.pop();
                return {
                    ...state,
                    snake: newSnake,
                    movesCount: state.movesCount + 1,
                };
            }
        }

        default:
            return state;
    }
};

const Overlay = React.memo(
    ({
         title,
         body,
     }: {
        title: string;
        body: React.ReactNode;
    }) => (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black bg-opacity-70">
            <div className="bg-gradient-to-br from-green-600 to-green-800 p-8 rounded-lg shadow-2xl text-center">
                <h2 className="text-3xl font-bold text-white mb-4">{title}</h2>
                {body}
            </div>
        </div>
    )
);

const GameGrid = React.memo(
    ({snake, food, size, direction}: { snake: Point[]; food: Point; size: number, direction: Direction }) => {
        const snakeSet = useMemo(
            () => new Set(snake.map((p) => `${p.x},${p.y}`)),
            [snake]
        );

        return (
            <div
                className="grid border-4 border-gray-700 bg-slate-800 rounded-lg overflow-hidden shadow-2xl h-full aspect-square max-h-full">
                {Array.from({length: size}).map((_, y) => (
                    <div key={y} className="flex flex-1">
                        {Array.from({length: size}).map((_, x) => {
                            const key = `${x},${y}`;
                            const isHead = key === `${snake[0].x},${snake[0].y}`;
                            const isBody = snakeSet.has(key) && !isHead;
                            const isFood = key === `${food.x},${food.y}`;

                            return (<div
                                    key={x}
                                    className={`flex-1 border border-slate-700
                                        ${isHead && "bg-green-400 shadow-lg shadow-green-500/50"}
                                        ${isBody && "bg-green-600"}
                                        ${isFood && "bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50"}`
                                    }
                                />
                            );
                        })}
                    </div>
                ))}
            </div>
        );
    }
);

export const SnakeGrid = () => {

    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);


    const [state, dispatch] = useReducer(reducer, {
        snake: initialSnake,
        food: generateFood(initialSnake),
        direction: "right",
        gameOver: false,
        score: 0,
        level: 1,
        highScore: (() => {
            try {
                return Number(localStorage.getItem("snakeHighScore")) || 0;
            } catch {
                return 0;
            }
        })(),
        gameStartTime: Date.now(),
        movesCount: 0,
        gameStarted: false,
    });

    const containerRef = useRef<HTMLDivElement>(null);
    const dirRef = useRef<Direction>("right");
    const lastMoveTimeRef = useRef<number>(0);
    const animationFrameRef = useRef<number>(0);

    const speed = useMemo(() => {
        return Math.max(
            MIN_SPEED,
            INITIAL_SPEED - (state.level - 1) * SPEED_DECREASE_PER_LEVEL
        );
    }, [state.level]);

    const loop = useCallback(
        (timestamp: number) => {
            if (!state.gameStarted || state.gameOver) return;

            const delta = timestamp - lastMoveTimeRef.current;
            if (delta >= speed) {
                lastMoveTimeRef.current = timestamp;
                dispatch({type: "MOVE", dir: dirRef.current});
            }
            animationFrameRef.current = requestAnimationFrame(loop);
        },
        [state.gameStarted, state.gameOver, speed]
    );

    useEffect(() => {
        animationFrameRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animationFrameRef.current!);
    }, [loop]);

    const handleKey = useCallback(
        (e: KeyboardEvent) => {
            if (!state.gameStarted) return;

            const current = dirRef.current;
            switch (e.key) {
                case "ArrowUp":
                    if (current !== "down") dirRef.current = "up";
                    break;
                case "ArrowDown":
                    if (current !== "up") dirRef.current = "down";
                    break;
                case "ArrowLeft":
                    if (current !== "right") dirRef.current = "left";
                    break;
                case "ArrowRight":
                    if (current !== "left") dirRef.current = "right";
                    break;
            }
        },
        [state.gameStarted]
    );

    useEffect(() => {
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [handleKey]);

    const {snake, food, score, level, highScore, direction, gameOver, gameStarted} = state;

    return (
        <>
            {mounted && (
                <div className="flex flex-col items-center justify-center gap-4 p-4 h-[90vh] w-screen overflow-hidden">
                    <div
                        ref={containerRef}
                        id="game-container"
                        className="relative flex-1 flex items-center justify-center max-h-[calc(100vh-180px)]"
                        tabIndex={0}
                        onFocus={() => containerRef.current?.focus()}
                    >
                        {!gameStarted && !gameOver && (
                            <Overlay
                                title="Welcome to Snake!"
                                body={
                                    <>
                                        <p className="text-white mb-4">
                                            Use arrow keys to move, eat the food to grow.
                                        </p>
                                        <p className="text-white mb-6">
                                            Avoid walls and your own tail!
                                        </p>
                                        <button
                                            onClick={() => dispatch({type: "START"})}
                                            className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-colors text-lg"
                                        >
                                            Start Game
                                        </button>
                                    </>
                                }
                            />
                        )}

                        {gameOver && (
                            <Overlay
                                title="Game Over!"
                                body={
                                    <>
                                        <div className="text-white mb-6">
                                            <p className="text-xl mb-2">
                                                Final Score: <span className="font-bold text-yellow-300">{score}</span>
                                            </p>
                                            <p className="text-lg">
                                                Level Reached: <span className="font-bold text-blue-300">{level}</span>
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => dispatch({type: "RESTART"})}
                                            className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-colors"
                                        >
                                            Play Again
                                        </button>
                                    </>
                                }
                            />
                        )}

                        <GameGrid snake={snake} food={food} size={GRID_SIZE} direction={direction}/>
                    </div>

                    <div className="text-center text-white">
                        <p>Score: {score}</p>
                        <p>Level: {level}</p>
                        <p>High Score: {highScore}</p>
                    </div>

                    <p className="text-center text-gray-400 text-xs">
                        Speed increases every {LEVEL_UP_THRESHOLD} points
                    </p>
                </div>)}
        </>
    );
};
