import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, User, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Message {
    role: "assistant" | "user";
    content: string;
    timestamp: Date;
}

export function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            content: "Hello! I'm Sentie. How can I help you with your shipments today?",
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = () => {
        if (!input.trim()) return;

        const userMessage: Message = {
            role: "user",
            content: input,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");

        // Mimic AI thinking
        setTimeout(() => {
            const assistantMessage: Message = {
                role: "assistant",
                content: "I'm Sentie, your logistics assistant. I'm currently in demo mode, but soon I'll be able to help you reconcile invoices, track shipments, and resolve disputes in real-time!",
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMessage]);
        }, 1000);
    };

    return (
        <Card className="flex flex-col h-[400px] border-primary/20 bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardHeader className="pb-3 border-b bg-primary/5">
                <CardTitle className="flex items-center justify-between text-lg">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                        Sentie Assistant
                    </div>
                    <Badge variant="secondary" className="text-[10px] h-5 uppercase tracking-wider">Beta</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 flex flex-col min-h-0">
                <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                    <div className="space-y-4">
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""
                                    }`}
                            >
                                <div
                                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === "assistant"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground"
                                        }`}
                                >
                                    {msg.role === "assistant" ? (
                                        <Bot className="w-4 h-4" />
                                    ) : (
                                        <User className="w-4 h-4" />
                                    )}
                                </div>
                                <div
                                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${msg.role === "assistant"
                                        ? "bg-muted/50 text-foreground rounded-tl-none"
                                        : "bg-primary text-primary-foreground rounded-tr-none"
                                        }`}
                                >
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                <div className="p-4 border-t bg-muted/20">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSend();
                        }}
                        className="flex gap-2"
                    >
                        <Input
                            placeholder="Ask Sentie anything..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            className="bg-background border-primary/10 focus-visible:ring-primary/30"
                        />
                        <Button type="submit" size="icon" className="shrink-0 bg-primary hover:bg-primary/90">
                            <Send className="w-4 h-4" />
                        </Button>
                    </form>
                </div>
            </CardContent>
        </Card>
    );
}
