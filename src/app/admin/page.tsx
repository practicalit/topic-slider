"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Topic {
  id: string;
  title: string;
  description: string | null;
  taught: boolean;
  taughtAt: string | null;
  _count: { contents: number; quizzes: number };
}

export default function AdminPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session && session.user?.role !== "ADMIN") {
      router.push("/");
    }
  }, [session, router]);

  useEffect(() => {
    fetchTopics();
  }, []);

  async function fetchTopics() {
    const res = await fetch("/api/topics");
    const data = await res.json();
    setTopics(data);
    setLoading(false);
  }

  async function handleCreateTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    await fetch("/api/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });

    setTitle("");
    setDescription("");
    fetchTopics();
  }

  async function handleDeleteTopic(id: string) {
    if (!confirm("Delete this topic and all its content?")) return;
    await fetch(`/api/topics/${id}`, { method: "DELETE" });
    fetchTopics();
  }

  async function handleToggleTaught(id: string, currentlyTaught: boolean) {
    await fetch(`/api/topics/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taught: !currentlyTaught }),
    });
    fetchTopics();
  }

  if (loading) {
    return <div className="flex justify-center py-20 text-gray-500">Loading...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Panel</h1>

      {/* Create Topic Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create New Topic</h2>
        <form onSubmit={handleCreateTopic} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Topic title"
            required
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
          />
          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            Add Topic
          </button>
        </form>
      </div>

      {/* Topics List */}
      <div className="space-y-4">
        {topics.length === 0 && (
          <p className="text-gray-500 text-center py-8">No topics yet. Create one above.</p>
        )}
        {topics.map((topic) => (
          <div
            key={topic.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-start justify-between gap-4"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-lg font-semibold text-gray-900">{topic.title}</h3>
                {topic.taught && (
                  <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                    Taught
                  </span>
                )}
              </div>
              {topic.description && (
                <p className="text-gray-500 text-sm mb-2">{topic.description}</p>
              )}
              <p className="text-xs text-gray-400">
                {topic._count.contents} content slide(s) · {topic._count.quizzes} quiz question(s)
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => handleToggleTaught(topic.id, topic.taught)}
                className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  topic.taught
                    ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                    : "bg-green-100 text-green-700 hover:bg-green-200"
                }`}
              >
                {topic.taught ? "Mark Untaught" : "Mark Taught"}
              </button>
              <Link
                href={`/admin/topics/${topic.id}`}
                className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                Edit Content
              </Link>
              <button
                onClick={() => handleDeleteTopic(topic.id)}
                className="bg-red-100 text-red-700 hover:bg-red-200 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
