import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Send, Loader2, MessageSquare, Bot, User } from "lucide-react";
import { Streamdown } from "streamdown";

export default function AIAssistant() {
  const [message, setMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.message,
        },
      ]);
      setConversationId(data.conversationId);
    },
    onError: (error) => {
      toast.error(error.message || "حدث خطأ أثناء التواصل مع المساعد");
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || chatMutation.isPending) return;

    // إضافة رسالة المستخدم
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: message,
      },
    ]);

    // إرسال الرسالة
    chatMutation.mutate({
      message,
      conversationId,
    });

    setMessage("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">المساعد الذكي</h1>
        <p className="text-muted-foreground mt-2">اسأل عن أي شيء يتعلق بمتجرك وحملاتك</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Chat Area */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              المحادثة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Messages */}
            <div className="h-[500px] overflow-y-auto space-y-4 p-4 bg-muted/30 rounded-lg">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">ابدأ محادثة جديدة</h3>
                  <p className="text-muted-foreground max-w-md">
                    يمكنك سؤال المساعد عن أداء متجرك، تحليل الحملات، توصيات لتحسين المبيعات، وأي شيء آخر
                  </p>
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`max-w-[80%] rounded-lg p-4 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-card border"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <Streamdown>{msg.content}</Streamdown>
                      ) : (
                        <p className="text-sm">{msg.content}</p>
                      )}
                    </div>
                    {msg.role === "user" && (
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-secondary">
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))
              )}
              {chatMutation.isPending && (
                <div className="flex gap-3 justify-start">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-card border rounded-lg p-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="اكتب رسالتك هنا..."
                disabled={chatMutation.isPending}
                className="flex-1"
              />
              <Button type="submit" disabled={chatMutation.isPending || !message.trim()}>
                {chatMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Suggestions */}
        <Card>
          <CardHeader>
            <CardTitle>أسئلة مقترحة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              "ما هو أداء متجري هذا الشهر؟",
              "ما هي أفضل المنتجات مبيعاً؟",
              "كيف يمكنني تحسين ROAS للحملات؟",
              "ما هي الطلبات التي تحتاج متابعة؟",
              "اقترح استراتيجية تسويقية جديدة",
            ].map((suggestion, index) => (
              <Button
                key={index}
                variant="outline"
                className="w-full justify-start text-right h-auto py-3"
                onClick={() => {
                  setMessage(suggestion);
                }}
                disabled={chatMutation.isPending}
              >
                <span className="text-sm">{suggestion}</span>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
