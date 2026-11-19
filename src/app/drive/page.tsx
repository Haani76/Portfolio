import type { Metadata } from "next";
import DriveExperience from "@/components/drive/DriveExperience";

export const metadata: Metadata = {
  title: "Drive mode",
  description: "Drive a winding road and stop at checkpoints to explore Haani's experience, projects and skills.",
};

export default function DrivePage() {
  return <DriveExperience />;
}
