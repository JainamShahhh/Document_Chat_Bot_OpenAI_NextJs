import React, { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useAtom } from "jotai";
import {
  assistantAtom,
  messagesAtom,
  runAtom,
  runStateAtom,
  threadAtom,
} from "@/atom";
import { Button } from "@/components/ui/button";
import { ThreadMessage } from "openai/resources/beta/threads/messages/messages.mjs";
import { Run } from "openai/resources/beta/threads/runs/runs.mjs";

function ChatContainer() {
  // Atom State
  const [thread] = useAtom(threadAtom);
  const [messages, setMessages] = useAtom(messagesAtom);
  const [run, setRun] = useAtom(runAtom);
  const [, setRunState] = useAtom(runStateAtom);
  const [assistant] = useAtom(assistantAtom);

  // State
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [pollingIntervalId, setPollingIntervalId] = useState<NodeJS.Timeout | null>(null);

  const fetchMessages = async () => {
    setFetching(true);
    if (!thread) return;

    try {
      const response = await axios.get<{ messages: ThreadMessage[] }>(
        `/api/message/list?threadId=${thread.id}`
      );
      let newMessages = response.data.messages;

      // Sort messages in descending order by createdAt
      newMessages = newMessages.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setMessages(newMessages);
    } catch (error) {
      console.log("error", error);
      toast.error("Error fetching messages", { position: "bottom-center" });
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [thread]);

  const sendMessage = async () => {
    if (!thread) return;
    setSending(true);

    try {
      const response = await axios.post<{ message: ThreadMessage }>(
        `/api/message/create?threadId=${thread.id}&message=${message}`,
        { message: message, threadId: thread.id }
      );

      const newMessage = response.data.message;
      setMessages([...messages, newMessage]);
      setMessage("");
      toast.success("Successfully sent message", { position: "bottom-center" });
    } catch (error) {
      console.log("error", error);
      toast.error("Error sending message", { position: "bottom-center" });
    } finally {
      setSending(false);
    }
  };

  const startPolling = (runId: string) => {
    if (!thread) return;
    const intervalId = setInterval(async () => {
      try {
        const response = await axios.get<{ run: Run }>(
          `/api/run/retrieve?threadId=${thread.id}&runId=${runId}`
        );
        const updatedRun = response.data.run;

        setRun(updatedRun);
        setRunState(updatedRun.status);

        if (["cancelled", "failed", "completed", "expired"].includes(updatedRun.status)) {
          clearInterval(intervalId);
          setPollingIntervalId(null);
          fetchMessages();
        }
      } catch (error) {
        console.error("Error polling run status:", error);
        clearInterval(intervalId);
        setPollingIntervalId(null);
      }
    }, 500);

    setPollingIntervalId(intervalId);
  };

  const handleCreate = async () => {
    if (!assistant || !thread) return;

    setCreating(true);
    try {
      const response = await axios.get<{ run: Run }>(
        `/api/run/create?threadId=${thread.id}&assistantId=${assistant.id}`
      );

      const newRun = response.data.run;
      setRunState(newRun.status);
      setRun(newRun);
      localStorage.setItem("run", JSON.stringify(newRun));

      // Start polling after creation
      startPolling(newRun.id);
    } catch (error) {
      toast.error("Error creating run.", { position: "bottom-center" });
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = async () => {
    if (!run || !thread) return;

    setCanceling(true);
    try {
      const response = await axios.get<{ run: Run }>(
        `/api/run/cancel?runId=${run.id}&threadId=${thread.id}`
      );

      const newRun = response.data.run;
      setRunState(newRun.status);
      setRun(newRun);
      toast.success("Run canceled", { position: "bottom-center" });
      localStorage.setItem("run", JSON.stringify(newRun));
    } catch (error) {
      toast.error("Error canceling run.", { position: "bottom-center" });
      console.error(error);
    } finally {
      setCanceling(false);
    }
  };

  return (
    <div className="flex flex-col w-full h-full max-h-screen rounded-lg border-blue-200 border-solid border-2 p-10">
      {/* Messages */}
      <div className="flex flex-col h-full max-h-[calc(100vh-400px)] overflow-y-auto border-blue-200 border-solid border-2 p-6 rounded-lg">
        {fetching && <div className="m-auto font-bold">Start a Conversation</div>}
        {!fetching && messages.length === 0 && (
          <div className="m-auto font-bold">No messages found for thread.</div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`px-4 py-2 mb-3 rounded-lg text-white w-fit text-lg ${
              message.role === "user"
                ? " bg-blue-500 ml-auto text-right"
                : " bg-gray-500"
            }`}
          >
            {message.content[0].type === "text" ? message.content[0].text.value : null}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex flex-row w-full mt-5">
        <input
          type="text"
          className="flex-grow rounded-lg border-blue-200 border-solid border-2 p-2"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button
          disabled={!thread || sending || message === ""}
          className="rounded-lg bg-blue-500 text-white p-2 ml-4 disabled:bg-blue-200"
          onClick={async () => {
            await sendMessage();
            await handleCreate();
          }}
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}

export default ChatContainer;
