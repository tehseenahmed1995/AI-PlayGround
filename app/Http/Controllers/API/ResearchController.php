<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Http\Requests\ResearchRequest;
use App\Services\ResearchService;

class ResearchController extends Controller
{
    public function __construct(
        private readonly ResearchService $researchService,
    ) {}

    public function research(ResearchRequest $request): mixed
    {
        return $this->researchService->research($request->input('question'));
    }
}
