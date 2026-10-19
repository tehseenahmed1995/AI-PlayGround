<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Requests\ImageGenerateRequest;
use App\Services\ImageService;
use Illuminate\Http\JsonResponse;

class ImageController extends Controller
{
    public function __construct(
        private readonly ImageService $imageService,
    ) {}

    public function generate(ImageGenerateRequest $request): JsonResponse
    {
        $result = $this->imageService->generate(
            prompt: $request->input('prompt'),
            size: $request->input('size', 'square'),
        );

        return response()->json($result);
    }
}
