import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AvatarGroupUser {
  id: string;
  full_name: string;
  avatar_url?: string | null;
}

interface AvatarGroupProps {
  users: AvatarGroupUser[];
  max?: number;
  size?: "sm" | "md";
  className?: string;
}

export function AvatarGroup({
  users,
  max = 3,
  size = "sm",
  className,
}: AvatarGroupProps) {
  const visible = users.slice(0, max);
  const remaining = users.length - max;

  const sizeClasses = {
    sm: "h-6 w-6 text-[10px]",
    md: "h-8 w-8 text-xs",
  };

  return (
    <TooltipProvider>
      <div className={cn("flex -space-x-2", className)}>
        {visible.map((user) => (
          <Tooltip key={user.id}>
            <TooltipTrigger asChild>
              <Avatar
                className={cn(
                  "border-2 border-background",
                  sizeClasses[size]
                )}
              >
                {user.avatar_url && <AvatarImage src={user.avatar_url} />}
                <AvatarFallback className="text-[10px] font-medium">
                  {getInitials(user.full_name)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <p>{user.full_name}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {remaining > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "flex items-center justify-center rounded-full border-2 border-background bg-muted font-medium text-muted-foreground",
                  sizeClasses[size]
                )}
              >
                +{remaining}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {users
                  .slice(max)
                  .map((u) => u.full_name)
                  .join(", ")}
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
