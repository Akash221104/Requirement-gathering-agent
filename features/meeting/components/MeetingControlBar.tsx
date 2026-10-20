'use client';

import React, { useState } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { Button } from '@/components/ui/button';
import type { ParticipantRole } from '@/types/meeting';
import {
  MicIcon,
  MicOffIcon,
  VideoIcon,
  VideoOffIcon,
  PhoneOffIcon,
  SparklesIcon,
  Volume2Icon,
  VolumeXIcon,
  Loader2Icon,
  Share2Icon,
  CheckIcon,
} from 'lucide-react';

interface MeetingControlBarProps {
  onLeave: () => void;
  userRole?: ParticipantRole;
  isWorkspaceOpen?: boolean;
  onToggleWorkspace?: () => void;
  isTranscriptOpen?: boolean;
  onToggleTranscript?: () => void;
  isIntelligenceOpen?: boolean;
  onToggleIntelligence?: () => void;
  intelligenceCount?: number;
  voiceInterventionEnabled?: boolean;
  onToggleVoiceIntervention?: () => void;
  voiceTogglingInProgress?: boolean;
}

export function MeetingControlBar({
  onLeave,
  userRole = 'engineer',
  isWorkspaceOpen = true,
  onToggleWorkspace,
  intelligenceCount = 0,
  voiceInterventionEnabled = false,
  onToggleVoiceIntervention,
  voiceTogglingInProgress = false,
}: MeetingControlBarProps) {
  const { isMicrophoneEnabled, isCameraEnabled, localParticipant } = useLocalParticipant();
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const isCustomer = userRole?.toLowerCase().includes('customer');

  const toggleMic = async () => {
    try {
      setDeviceError(null);
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Microphone toggle failed';
      setDeviceError(msg);
    }
  };

  const toggleCamera = async () => {
    try {
      setDeviceError(null);
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Camera toggle failed';
      setDeviceError(msg);
    }
  };

  // -------------------------------------------------------------
  // CUSTOMER VIEW CONTROLS
  // Clean, minimal, non-intrusive: [Mic] [Camera] [Leave]
  // -------------------------------------------------------------
  if (isCustomer) {
    return (
      <div className="flex flex-col items-center gap-2">
        {deviceError && (
          <div className="rounded-md bg-red-950/80 px-3 py-1 text-xs text-red-300 border border-red-800">
            {deviceError}
          </div>
        )}

        <div className="flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-900/90 px-6 py-2.5 shadow-2xl backdrop-blur-lg">
          {/* Mic Button */}
          <Button
            type="button"
            variant={isMicrophoneEnabled ? 'secondary' : 'destructive'}
            size="sm"
            className="rounded-full gap-2 px-4 transition-all"
            onClick={toggleMic}
            title={isMicrophoneEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {isMicrophoneEnabled ? (
              <>
                <MicIcon className="size-4 text-emerald-400" />
                <span className="text-xs">Mute</span>
              </>
            ) : (
              <>
                <MicOffIcon className="size-4" />
                <span className="text-xs">Unmute</span>
              </>
            )}
          </Button>

          {/* Camera Button */}
          <Button
            type="button"
            variant={isCameraEnabled ? 'secondary' : 'destructive'}
            size="sm"
            className="rounded-full gap-2 px-4 transition-all"
            onClick={toggleCamera}
            title={isCameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {isCameraEnabled ? (
              <>
                <VideoIcon className="size-4 text-blue-400" />
                <span className="text-xs">Stop Video</span>
              </>
            ) : (
              <>
                <VideoOffIcon className="size-4" />
                <span className="text-xs">Start Video</span>
              </>
            )}
          </Button>

          {/* Share Link Button */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="rounded-full gap-2 px-4 border border-zinc-700 bg-zinc-800/90 hover:bg-zinc-700 text-zinc-100 transition-all shadow-sm"
            onClick={() => {
              if (typeof window !== 'undefined') {
                navigator.clipboard.writeText(window.location.href);
                setShareCopied(true);
                setTimeout(() => setShareCopied(false), 2000);
              }
            }}
            title="Share Meeting Link"
          >
            {shareCopied ? (
              <>
                <CheckIcon className="size-4 text-emerald-400" />
                <span className="text-xs text-emerald-400 font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Share2Icon className="size-4 text-zinc-400" />
                <span className="text-xs">Share Link</span>
              </>
            )}
          </Button>

          {/* Leave Button */}
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="rounded-full gap-2 px-4 bg-red-600 hover:bg-red-700 text-white transition-all shadow-md ml-2"
            onClick={onLeave}
            title="Leave Meeting"
          >
            <PhoneOffIcon className="size-4" />
            <span className="text-xs font-semibold">Leave</span>
          </Button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // REQUIREMENT ENGINEER VIEW CONTROLS
  // Grouped: Participant Controls | Engineer AI Controls | Leave
  // -------------------------------------------------------------
  return (
    <div className="flex flex-col items-center gap-2">
      {deviceError && (
        <div className="rounded-md bg-red-950/80 px-3 py-1 text-xs text-red-300 border border-red-800">
          {deviceError}
        </div>
      )}

      <div className="flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-900/90 px-6 py-2.5 shadow-2xl backdrop-blur-lg">
        {/* GROUP 1: PARTICIPANT CONTROLS */}
        <div className="flex items-center gap-2">
          {/* Mic Button */}
          <Button
            type="button"
            variant={isMicrophoneEnabled ? 'secondary' : 'destructive'}
            size="sm"
            className="rounded-full gap-2 px-4 transition-all"
            onClick={toggleMic}
            title={isMicrophoneEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {isMicrophoneEnabled ? (
              <>
                <MicIcon className="size-4 text-emerald-400" />
                <span className="text-xs">Mute</span>
              </>
            ) : (
              <>
                <MicOffIcon className="size-4" />
                <span className="text-xs">Unmute</span>
              </>
            )}
          </Button>

          {/* Camera Button */}
          <Button
            type="button"
            variant={isCameraEnabled ? 'secondary' : 'destructive'}
            size="sm"
            className="rounded-full gap-2 px-4 transition-all"
            onClick={toggleCamera}
            title={isCameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {isCameraEnabled ? (
              <>
                <VideoIcon className="size-4 text-blue-400" />
                <span className="text-xs">Stop Video</span>
              </>
            ) : (
              <>
                <VideoOffIcon className="size-4" />
                <span className="text-xs">Start Video</span>
              </>
            )}
          </Button>
        </div>

        {/* Visual Divider */}
        <div className="h-6 w-px bg-zinc-700/60 mx-1" />

        {/* GROUP 2: ENGINEER AI CONTROLS */}
        <div className="flex items-center gap-2">
          {/* Workspace Toggle */}
          {onToggleWorkspace && (
            <Button
              type="button"
              variant={isWorkspaceOpen ? 'secondary' : 'outline'}
              size="sm"
              className="rounded-full gap-2 px-4 transition-all border-zinc-700"
              onClick={onToggleWorkspace}
              title={isWorkspaceOpen ? 'Hide Co-Pilot Workspace' : 'Open Co-Pilot Workspace'}
            >
              <SparklesIcon className="size-4 text-indigo-400" />
              <span className="text-xs">Co-Pilot Workspace</span>
              {intelligenceCount > 0 && (
                <span className="rounded-full bg-indigo-500/30 text-indigo-300 text-[10px] px-1.5 py-0 font-mono">
                  {intelligenceCount}
                </span>
              )}
            </Button>
          )}

          {/* SpecPilot Voice Intervention Toggle */}
          {onToggleVoiceIntervention && (
            <Button
              type="button"
              variant={voiceInterventionEnabled ? 'secondary' : 'outline'}
              size="sm"
              className={`rounded-full gap-2 px-4 transition-all ${
                voiceInterventionEnabled
                  ? 'border-violet-600/60 bg-violet-950/60 text-violet-200 hover:bg-violet-900/60'
                  : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'
              }`}
              onClick={onToggleVoiceIntervention}
              disabled={voiceTogglingInProgress}
              title={
                voiceInterventionEnabled
                  ? 'Mute SpecPilot Voice Intervention (Silence AI Spoken Interventions)'
                  : 'Enable SpecPilot Voice Intervention (Allow AI Spoken Interventions)'
              }
            >
              {voiceTogglingInProgress ? (
                <Loader2Icon className="size-4 animate-spin text-zinc-400" />
              ) : voiceInterventionEnabled ? (
                <Volume2Icon className="size-4 text-violet-400" />
              ) : (
                <VolumeXIcon className="size-4 text-zinc-500" />
              )}
              <span className="text-xs">
                {voiceInterventionEnabled ? 'AI Voice: On' : 'AI Voice: Muted'}
              </span>
            </Button>
          )}
        </div>

        {/* Visual Divider */}
        <div className="h-6 w-px bg-zinc-700/60 mx-1" />

        {/* GROUP 3: LEAVE CONTROL */}
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="rounded-full gap-2 px-4 bg-red-600 hover:bg-red-700 text-white transition-all shadow-md"
          onClick={onLeave}
          title="Leave Meeting"
        >
          <PhoneOffIcon className="size-4" />
          <span className="text-xs font-semibold">Leave</span>
        </Button>
      </div>
    </div>
  );
}
