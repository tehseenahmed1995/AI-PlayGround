<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Requests\AudioTranscribeRequest;
use App\Services\AudioService;
use Illuminate\Http\JsonResponse;

class AudioController extends Controller
{
    public function __construct(
        private readonly AudioService $audioService,
    ) {}

    public function transcribe(AudioTranscribeRequest $request): JsonResponse
    {
        $transcript = $this->audioService->transcribe($request->file('audio'));

        return response()->json(['transcript' => $transcript]);
    }
}
