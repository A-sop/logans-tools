'use client';

import { useState } from 'react';
import { LikeToggleButton } from '@/components/ui/like-toggle-button';
import { DatePicker } from '@/components/ui/date-picker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Demo page for design-inspiration components:
 * - LikeToggleButton (togglebutton1)
 * - DatePicker (date-picker)
 */
export default function DesignDemoPage() {
  const [likeCount, setLikeCount] = useState(23);
  const [isLiked, setIsLiked] = useState(false);
  const [date, setDate] = useState<Date | undefined>();

  const handleLikeToggle = (liked: boolean) => {
    setIsLiked(liked);
    setLikeCount((c) => (liked ? c + 1 : c - 1));
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-2xl space-y-12">
        <div>
          <h1 className="text-2xl font-bold">Design Inspiration Components</h1>
          <p className="mt-1 text-muted-foreground">
            Recreated from src/docs/design-inspiration/
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Like Toggle Button</CardTitle>
            <CardDescription>
              From togglebutton1.png — heart icon, count, unselected (outline) and selected (filled purple) states
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4">
            <LikeToggleButton
              count={likeCount}
              isLiked={isLiked}
              onToggle={handleLikeToggle}
            />
            <span className="text-sm text-muted-foreground">
              State: {isLiked ? 'liked' : 'unliked'} • Count: {likeCount}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Date Picker (Default)</CardTitle>
            <CardDescription>
              From date-picker.png — input + Clear/Today actions. Light theme.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DatePicker value={date} onChange={setDate} variant="default" />
            {date && (
              <p className="mt-3 text-sm text-muted-foreground">
                Selected: {date.toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-[#2a2d35] bg-[#1a1d24]">
          <CardHeader>
            <CardTitle className="text-gray-200">Date Picker (Dark)</CardTitle>
            <CardDescription className="text-gray-400">
              Dark variant matching the design screenshot
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DatePicker value={date} onChange={setDate} variant="dark" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
