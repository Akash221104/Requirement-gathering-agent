import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import type { CandidateRequirement, CandidateRequirementStatus, CandidateRequirementType } from '@/types/requirement';
import { requirementVersionService } from '@/features/requirements/services/requirement-version-service';
import { documentStore } from '@/lib/storage/document-store';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;
    const projectId = req.nextUrl.searchParams.get('projectId') || 'project-001';
    const body = await req.json();

    const cleanId = meetingId.replace(/^meeting-/, '');
    const intelPath = path.join(
      process.cwd(),
      'data',
      'projects',
      projectId,
      'meetings',
      `meeting-${cleanId}-intelligence.json`
    );

    let intel: {
      meetingId: string;
      projectId: string;
      candidateRequirements: CandidateRequirement[];
      issues: any[];
      clarificationQuestions: any[];
      lastUpdated: string;
    } = {
      meetingId,
      projectId,
      candidateRequirements: [],
      issues: [],
      clarificationQuestions: [],
      lastUpdated: new Date().toISOString(),
    };

    try {
      const raw = await fs.readFile(intelPath, 'utf-8');
      intel = JSON.parse(raw);
    } catch {
      await fs.mkdir(path.dirname(intelPath), { recursive: true });
    }

    const reviewedBy = body.reviewedBy || 'Lead Requirement Engineer';
    const now = new Date().toISOString();

    // BULK APPROVAL: If approveAll is passed, approve every pending requirement in one click
    if (body.approveAll) {
      for (const item of intel.candidateRequirements) {
        if (item.status !== 'APPROVED') {
          item.status = 'APPROVED';
          item.reviewedBy = reviewedBy;
          item.reviewedAt = now;
          item.notes = 'Bulk approved by Lead Requirement Engineer';
          try {
            await requirementVersionService.approveCandidateRequirement(
              item.id,
              item.requirementText,
              item.type === 'FUNCTIONAL' ? 'functional' : 'non_functional',
              projectId,
              reviewedBy
            );
          } catch (e) {
            console.warn('[ReviewItem] Bulk approval sync notice:', e);
          }
        }
      }

      intel.lastUpdated = now;
      await fs.writeFile(intelPath, JSON.stringify(intel, null, 2), 'utf-8');

      // Re-generate documents bundle with updated approved items
      try {
        const { meetingDocumentService } = await import('@/features/requirements/services/meeting-document-service');
        await meetingDocumentService.generateDocumentsForMeeting(meetingId, projectId);
      } catch {}

      return NextResponse.json({
        success: true,
        approvedCount: intel.candidateRequirements.length,
        candidateRequirements: intel.candidateRequirements,
        updatedAt: now,
      });
    }

    const {
      id,
      requirementText,
      type,
      priority,
      status,
      notes,
      taggedForNextMeeting,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Requirement ID is required' }, { status: 400 });
    }

    // Find or create candidate requirement
    let item = intel.candidateRequirements.find((r) => r.id === id);

    if (!item) {
      item = {
        id,
        meetingId,
        requirementText: requirementText || 'Elicited Requirement',
        type: (type as CandidateRequirementType) || 'FUNCTIONAL',
        sourceSpeakerName: 'Customer Stakeholder',
        sourceSpeakerRole: 'CUSTOMER',
        sourceTurnRef: 'manual',
        confidence: 1.0,
        status: (status as CandidateRequirementStatus) || 'PROPOSED',
        timestamp: now,
      };
      intel.candidateRequirements.push(item);
    }

    // Apply edits
    if (requirementText !== undefined) item.requirementText = requirementText.trim();
    if (type !== undefined) item.type = type as CandidateRequirementType;
    if (status !== undefined) item.status = status as CandidateRequirementStatus;
    if (notes !== undefined) item.notes = notes;
    if (taggedForNextMeeting !== undefined) {
      item.taggedForNextMeeting = taggedForNextMeeting;
      if (taggedForNextMeeting) {
        item.status = 'TAGGED_FOR_NEXT_MEETING';
      }
    }
    if (priority !== undefined) item.priority = priority;

    item.reviewedBy = reviewedBy;
    item.reviewedAt = now;
    intel.lastUpdated = now;

    // If approved, update baseline in requirementVersionService
    if (item.status === 'APPROVED') {
      try {
        await requirementVersionService.approveCandidateRequirement(
          item.id,
          item.requirementText,
          item.type === 'FUNCTIONAL' ? 'functional' : 'non_functional',
          projectId,
          reviewedBy
        );
      } catch (e) {
        console.warn('[ReviewItem] Baseline sync notice:', e);
      }
    }

    // If tagged for next meeting, ensure a clarification question exists for SpecPilot
    if (item.status === 'TAGGED_FOR_NEXT_MEETING' || item.taggedForNextMeeting) {
      const qText = `Clarify requirement: "${item.requirementText}" (Tagged by ${reviewedBy})`;
      const existingQ = intel.clarificationQuestions.find((q) => q.requirementId === item?.id);
      if (!existingQ) {
        intel.clarificationQuestions.unshift({
          id: `CQ-${Date.now().toString(36)}`,
          requirementId: item.id,
          question: qText,
          rationale: item.notes || 'Flagged by Requirement Engineer to review and confirm with customer in next meeting.',
          suggestedTo: 'REQUIREMENT_ENGINEER',
          timestamp: now,
        });
      }
    }

    // Save updated intelligence
    await fs.writeFile(intelPath, JSON.stringify(intel, null, 2), 'utf-8');

    // Also synchronize documents bundle in background so markdown reflects the edit
    (async () => {
      try {
        const bundle = await documentStore.getDocuments(meetingId, projectId);
        if (bundle) {
          const { meetingDocumentService } = await import('@/features/requirements/services/meeting-document-service');
          await meetingDocumentService.generateDocumentsForMeeting(meetingId, projectId);
        }
      } catch (e) {
        console.warn('[ReviewItem] Background document sync notice:', e);
      }
    })();

    return NextResponse.json({
      success: true,
      item,
      updatedAt: now,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update review item';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
