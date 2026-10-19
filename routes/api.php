<?php

use App\Http\Controllers\API\AudioController;
use App\Http\Controllers\API\AuthController;
use App\Http\Controllers\API\ChatController;
use App\Http\Controllers\API\DocumentController;
use App\Http\Controllers\API\ImageController;
use App\Http\Controllers\API\ResearchController;
use App\Http\Controllers\API\SummarizeController;
use Illuminate\Support\Facades\Route;

// Public auth routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);

    // Chat
    Route::post('/chat', [ChatController::class, 'chat']);
    Route::get('/chat/history', [ChatController::class, 'history']);
    Route::delete('/chat/{conversationId}', [ChatController::class, 'destroy']);

    // Documents (Embeddings + RAG)
    Route::post('/documents', [DocumentController::class, 'store']);
    Route::post('/documents/search', [DocumentController::class, 'search']);
    Route::get('/documents', [DocumentController::class, 'index']);

    // Image Generation
    Route::post('/image/generate', [ImageController::class, 'generate']);

    // Audio Transcription
    Route::post('/audio/transcribe', [AudioController::class, 'transcribe']);

    // Summarization
    Route::post('/summarize', [SummarizeController::class, 'summarize']);

    // Research Agent
    Route::post('/research', [ResearchController::class, 'research']);
});
