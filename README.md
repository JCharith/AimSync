# AimSync - Precision Mechanics Trainer

AimSync is a professional-grade, browser-native aim training platform designed to push human reaction time and fine motor control. Built for FPS enthusiasts who want a low-latency training environment without the overhead of heavy desktop applications.

![Precision Mechanics](public/favicon.ico) <!-- Placeholder for a real logo if you have one, or just the favicon -->

## 🚀 Key Features

- **Browser Native Execution**: Zero installation required. Instant access to training from any modern browser.
- **Raw Input Mapping**: Direct 1:1 mouse input mapping with no artificial acceleration or smoothing.
- **Advanced Training Modes**: Over 11 specialized modes covering Flicking, Tracking, Target Switching, and Micro-adjusting.
- **Deep Performance Analytics**: Track macro and micro performance metrics via the integrated stats service and dashboard.
- **Sensitivity Calibration**: Built-in tools and analysis to help you find and refine your optimal mouse sensitivity.
- **Custom Routines**: Build and run personalized training schedules to target specific mechanical weaknesses.

## 🛠️ Technology Stack

- **Core**: [Next.js 16+](https://nextjs.org/) (App Router), [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Backend & Auth**: [Firebase 12](https://firebase.google.com/)
- **Rendering**: custom high-performance 3D Canvas engine with trigonometric holographic targets.

## 🎮 Training Modes

AimSync includes a comprehensive suite of training modules:

| Mode | Focus Area |
| :--- | :--- |
| **Static Flick** | Burst speed and precision on static targets. |
| **Tracking Mode** | Consistent target following and smooth motor control. |
| **Target Switch** | Efficient transitions between multiple high-priority targets. |
| **Micro Adjust** | Fine-tuned corrections for targets near your crosshair. |
| **Reaction Test** | Raw visual-to-motor response speed. |
| **Burst Reaction** | Rapid response to multiple targets in quick succession. |
| **Consistency Check** | Validating stability over extended sessions. |
| **Sensitivity Finder** | Algorithmic analysis to optimize your DPI/In-game sensitivity. |
| **Flick Benchmark** | Standardized testing to track your progress over time. |

## 📂 Project Structure

```text
AimSync/
├── app/               # Next.js App Router (Pages: Dashboard, Game, Leaderboard, etc.)
├── components/        # UI Components
│   └── modes/         # Individual Training Mode implementations
├── hooks/             # Custom React hooks (Game state, Auth, Firebase)
├── lib/               # Core Game Logic
│   ├── game/          # Engine, Hud, Routine, and Target logic
│   └── utils/         # Math, Spawning, Stats, and Storage services
├── public/            # Static assets
└── types/             # Global Type definitions
```

## 🛠️ Getting Started

### Prerequisites

- Node.js 20+
- A [Firebase](https://console.firebase.google.com/) project (for authentication and database)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-repo/AimSync.git
    cd AimSync
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure environment variables:**
    Create a `.env.local` file in the root directory and add your Firebase configuration:
    ```env
    NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
    # Add other necessary Firebase/API keys
    ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

Open [http://localhost:3000](http://localhost:3000) to begin training.

## 📊 Analytics & Progress

Every training session is recorded and analyzed. View your trends, strengths, and weaknesses in the **Dashboard** to see how you stack up on the global **Leaderboard**.

---
*Built for precision. Optimized for performance.*
