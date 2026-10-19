<?php

namespace App\Http\Controllers\API;

use App\DTOs\ChatRequestData;
use App\Http\Controllers\Controller;
use App\Http\Requests\ChatRequest;
use App\Services\ChatService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatController extends Controller
{
    public function __construct(
        private readonly ChatService $chatService,
    ) {}

    public function chat(ChatRequest $request): mixed
    {
        $data = new ChatRequestData(
            message: $request->input('message'),
            conversationId: $request->input('conversation_id'),
        );

        return $this->chatService->streamResponse($data, $request->user());
    }

    public function history(Request $request): JsonResponse
    {
        $history = $this->chatService->getHistory($request->user());

        return response()->json(['conversations' => $history]);
    }

    public function destroy(string $conversationId, Request $request): JsonResponse
    {
        $deleted = $this->chatService->deleteConversation($conversationId, $request->user());

        return response()->json(['deleted' => $deleted]);
    }
}
