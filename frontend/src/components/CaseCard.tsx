"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
} from "@/lib/constants";
import type { CaseInfo } from "@/lib/types";

interface CaseCardProps {
  caseInfo: CaseInfo;
}

export function CaseCard({ caseInfo }: CaseCardProps) {
  const categoryLabel = CATEGORY_LABELS[caseInfo.category] || caseInfo.category;
  const categoryColor = CATEGORY_COLORS[caseInfo.category] || "bg-gray-100 text-gray-800";
  const difficultyLabel = DIFFICULTY_LABELS[caseInfo.difficulty] || caseInfo.difficulty;
  const difficultyColor = DIFFICULTY_COLORS[caseInfo.difficulty] || "bg-gray-100 text-gray-800";

  const isVideoAvatar = caseInfo.avatar_type === "video";

  return (
    <Card className="flex flex-col h-full hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="secondary" className={categoryColor}>
            {categoryLabel}
          </Badge>
          <Badge variant="secondary" className={difficultyColor}>
            {difficultyLabel}
          </Badge>
          {isVideoAvatar && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              AI Human
            </Badge>
          )}
        </div>
        <CardTitle className="text-base">
          {caseInfo.name} ({caseInfo.age}세/{caseInfo.gender})
        </CardTitle>
        <p className="text-sm text-muted-foreground">{caseInfo.occupation}</p>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        <div>
          <p className="text-sm font-medium">호소 문제</p>
          <p className="text-sm text-muted-foreground">
            {caseInfo.presenting_issue}
          </p>
        </div>
        {caseInfo.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {caseInfo.description}
          </p>
        )}
        {caseInfo.session_goals.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-1">세션 목표</p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {caseInfo.session_goals.map((goal, i) => (
                <li key={i}>· {goal}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Link href={`/session/${caseInfo.id}`} className="w-full">
          <Button className="w-full" size="sm">
            상담 시작
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
