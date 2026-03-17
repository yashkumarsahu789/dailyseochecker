import React, { useState } from "react";

import { updateWebsiteDetails } from "../utils/firestore.js";export default function SiteEditModal({ site, onClose, onSaved }) {
  const [notes, setNotes] = useState(site.notes || "");
  const [group, setGroup] = useState(site.group || "Ungrouped");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState(site.tags || []);
  const [saving, setSaving] = useState(false);
  const [customGroup, setCustomGroup] = useState("");
  const [gaPropertyId, setGaPropertyId] = useState(site.gaPropertyId || "");

  const PRESET_GROUPS = [
    "Ungrouped",
    "Personal",
    "Client",
    "E-commerce",
    "Blog",
    "Portfolio",
    "SaaS",
  ];

  const addTag = () => {
    const t = tagInput
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "");
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  };

  const removeTag = (tag) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateWebsiteDetails(site.id, { notes, tags, group, gaPropertyId });
      onSaved();
      onClose();
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  };

  const addCustomGroup = () => {
    if (customGroup.trim()) {
      setGroup(customGroup.trim());
      setCustomGroup("");
    }
  };

  if (!site) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-700 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
          <h2 className="text-lg font-bold text-white">
            ✏️ Edit — {new URL(site.url).hostname}
          </h2>
          <button
            onClick={onClose}
            className="bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white w-8 h-8 rounded-full flex items-center justify-center transition"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Group */}
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">
              🏷️ Group
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {PRESET_GROUPS.map((g) => (
                <button
                  key={g}
                  onClick={() => setGroup(g)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    group === g
                      ? "bg-purple-600 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Custom group..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                value={customGroup}
                onChange={(e) => setCustomGroup(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomGroup()}
              />
              <button
                onClick={addCustomGroup}
                className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-bold"
              >
                Add
              </button>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">
              🔖 Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400"
                >
                  #{tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="text-cyan-600 hover:text-red-400 ml-1"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add tag..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), addTag())
                }
              />
              <button
                onClick={addTag}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-bold"
              >
                Add
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">
              📝 Notes
            </label>
            <textarea
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none transition resize-none h-24"
              placeholder="Add notes about this site..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* GA Property ID */}
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2">
              📊 GA4 Property ID
            </label>
            <input
              type="text"
              placeholder="e.g., 123456789"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-orange-500 outline-none"
              value={gaPropertyId}
              onChange={(e) => setGaPropertyId(e.target.value)}
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Find in Google Analytics → Admin → Property Settings
            </p>
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
