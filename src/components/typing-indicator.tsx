export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-muted p-4 rounded-lg flex items-center gap-1 w-fit">
        <div className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce"></div>
      </div>
    </div>
  );
}
