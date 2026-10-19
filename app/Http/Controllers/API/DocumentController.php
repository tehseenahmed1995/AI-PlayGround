<?php

namespace App\Http\Controllers\API;

use App\DTOs\DocumentSearchData;
use App\Http\Controllers\Controller;
use App\Http\Requests\DocumentSearchRequest;
use App\Http\Requests\DocumentUploadRequest;
use App\Http\Resources\DocumentResource;
use App\Services\DocumentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DocumentController extends Controller
{
    public function __construct(
        private readonly DocumentService $documentService,
    ) {}

    public function store(DocumentUploadRequest $request): JsonResponse
    {
        $documents = $this->documentService->storeDocument(
            $request->file('file'),
            $request->user(),
        );

        return response()->json([
            'message' => 'Document uploaded and processed.',
            'chunks' => $documents->count(),
        ], 201);
    }

    public function search(DocumentSearchRequest $request): JsonResponse
    {
        $data = new DocumentSearchData(
            query: $request->input('query'),
            limit: $request->input('limit', 5),
            minSimilarity: $request->input('min_similarity', 0.4),
        );

        $results = $this->documentService->search($data, $request->user());

        return response()->json([
            'results' => DocumentResource::collection($results),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $documents = $this->documentService->getUserDocuments($request->user());

        return response()->json(['documents' => $documents]);
    }
}
