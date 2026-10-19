<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Requests\SummarizeRequest;
use App\Services\SummarizeService;
use Illuminate\Http\JsonResponse;

class SummarizeController extends Controller
{
    public function __construct(
        private readonly SummarizeService $summarizeService,
    ) {}

    public function summarize(SummarizeRequest $request): JsonResponse
    {
        $summary = $this->summarizeService->summarize($request->input('text'));

        return response()->json(['summary' => $summary]);
    }
}
