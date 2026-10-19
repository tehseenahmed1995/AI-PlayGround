<?php

namespace App\Services;

use App\Ai\Agents\SupportAgent;
use App\DTOs\ChatRequestData;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ChatService
{
    public function streamResponse(ChatRequestData $data, User $user): mixed
    {
        $agent = (new SupportAgent($user));

        if ($data->conversationId) {
            $agent = $agent->continue($data->conversationId, as: $user);
        } else {
            $agent = $agent->forUser($user);
        }

        return $agent->stream($data->message);
    }

    public function getHistory(User $user): array
    {
        return DB::table('agent_conversations')
            ->where('user_id', $user->id)
            ->orderByDesc('updated_at')
            ->limit(50)
            ->get()
            ->map(fn ($conv) => [
                'id' => $conv->id,
                'created_at' => $conv->created_at,
                'updated_at' => $conv->updated_at,
            ])
            ->toArray();
    }

    public function deleteConversation(string $conversationId, User $user): bool
    {
        return DB::table('agent_conversations')
            ->where('id', $conversationId)
            ->where('user_id', $user->id)
            ->delete() > 0;
    }
}
