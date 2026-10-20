# SpecPilot — AI-Powered Requirements Engineering Agent

SpecPilot is an enterprise-grade AI Requirements Engineering system designed to autonomously participate in stakeholder discovery sessions, extract structured candidate requirements in real-time, enforce quality standards (ISO/IEC/IEEE 29148), detect ambiguities, and maintain a continuously evolving, single-source-of-truth Living Software Requirements Specification (SRS).

---

## Key Capabilities

- **Real-Time Voice Discovery Sessions**: Integrated with LiveKit WebRTC and Deepgram speech-to-text / text-to-speech for seamless autonomous or engineer-assisted elicitation.
- **Continuous Cross-Meeting Knowledge Base**: Ingests historical baselines, decision registers, and previous meeting transcripts so the agent never forgets past stakeholder context.
- **Differential Specification Mutation**: Automatically tracks and visualizes requirement evolutions (`ADDED`, `UPDATED`, `SUPERSEDED`, `OUT OF SCOPE`) across multi-session projects.
- **Formal ISO/IEC/IEEE 29148 Documentation**: One-click generation of audit-ready PDF/HTML engineering specifications with verification criteria, defect registers, and stakeholder sign-off blocks.
- **Enterprise Engineering Console**: Linear/Stripe-styled management console with high-contrast light theme, specification health ratings, and project portfolio tracking.

---

## Getting Started

### Prerequisites

- Node.js 18+
- LiveKit Cloud account (or self-hosted LiveKit server)
- Deepgram API Key (STT & Aura-2 TTS)
- LLM Provider Key (Groq or OpenRouter)

### Installation

1. Clone repository:
   ```bash
   git clone https://github.com/Akash221104/Requirement-gathering-agent.git
   cd Requirement-gathering-agent
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Copy `.env.example` to `.env.local` and populate your credentials:
   ```env
   LIVEKIT_URL=wss://your-livekit-url
   NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-url
   LIVEKIT_API_KEY=your_key
   LIVEKIT_API_SECRET=your_secret
   DEEPGRAM_API_KEY=your_deepgram_key
   GROQ_API_KEY=your_groq_key
   OPENROUTER_API_KEY=your_openrouter_key
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## License

MIT License.
