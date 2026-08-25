export const SUGGESTION_SETS: string[][] = [
  ["Contact Form", "Image Editor", "Mini Game", "Finance Calculator"],
  ["Landing Page", "Auth Flow", "Admin Dashboard", "CLI Tool"],
  ["REST API", "Chat Bot", "Docs Site", "Billing Portal"]
];

export const TEMPLATES = [
  {
    title: "Chat Template",
    description:
      "Interactive chat workbench starter with session sandbox tools."
  },
  {
    title: "Agent Pipeline",
    description: "Ticket board wired for multi-stage SDLC agent runs."
  },
  {
    title: "API Service",
    description: "Backend-focused workspace for Express-style services."
  },
  {
    title: "Next.js Boilerplate",
    description: "Frontend app starter ready for Forge sandbox preview."
  }
] as const;
