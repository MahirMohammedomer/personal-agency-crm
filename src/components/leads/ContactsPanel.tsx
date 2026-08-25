"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button, Card, Input, Label } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { apiDelete, apiPatch, apiPost } from "@/lib/api";
import type { Contact } from "@/lib/types";
import { cn, copyText, telHref, whatsappHref } from "@/lib/utils";

export function ContactsPanel({
  leadId,
  contacts,
  onChange,
}: {
  leadId: number;
  contacts: Contact[];
  onChange: () => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<Contact | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">Contacts</h2>
        <Button size="sm" onClick={() => setCreating(true)}>
          ＋ Add
        </Button>
      </div>

      {contacts.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-subtle">
          Add the owner, manager or whoever actually answers the phone.
        </p>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => {
            const tel = telHref(contact.phone);
            const wa = whatsappHref(contact.phone);
            const btn =
              "inline-flex h-7 w-7 items-center justify-center rounded-lg text-[12.5px] transition-colors hover:bg-surface";
            return (
              <div
                key={contact.id}
                className="group rounded-xl border border-line bg-surface-muted/40 p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                    {contact.name}
                    {contact.role ? (
                      <span className="font-normal text-subtle"> — {contact.role}</span>
                    ) : null}
                  </span>
                  {contact.isPrimary ? (
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10.5px] font-medium text-accent">
                      Primary
                    </span>
                  ) : null}
                </div>
                {contact.phone || contact.email ? (
                  <div className="mt-0.5 truncate text-[12px] text-muted">
                    {[contact.phone, contact.email].filter(Boolean).join(" · ")}
                  </div>
                ) : null}
                {contact.notes ? (
                  <p className="mt-1 text-[11.5px] text-subtle">{contact.notes}</p>
                ) : null}
                <div className="mt-1.5 flex items-center gap-0.5">
                  <button
                    className={btn}
                    title="Copy contact"
                    onClick={async () => {
                      const ok = await copyText(
                        [
                          contact.name,
                          contact.role ? `Role: ${contact.role}` : "",
                          contact.phone ? `Phone: ${contact.phone}` : "",
                          contact.email ? `Email: ${contact.email}` : "",
                        ]
                          .filter(Boolean)
                          .join("\n"),
                      );
                      toast(ok ? "Contact copied" : "Clipboard blocked", ok ? "success" : "error");
                    }}
                  >
                    📋
                  </button>
                  {tel ? (
                    <a href={tel} className={btn} title={contact.phone ?? "Call"}>
                      📞
                    </a>
                  ) : null}
                  {wa ? (
                    <a href={wa} target="_blank" rel="noreferrer" className={btn} title="WhatsApp">
                      💬
                    </a>
                  ) : null}
                  {contact.email ? (
                    <a href={`mailto:${contact.email}`} className={btn} title={contact.email}>
                      ✉️
                    </a>
                  ) : null}
                  <button
                    onClick={() => setEditing(contact)}
                    className={cn(btn, "ml-auto opacity-0 group-hover:opacity-100")}
                    title="Edit"
                  >
                    ✎
                  </button>
                  <button
                    onClick={async () => {
                      await apiDelete(`/api/contacts?id=${contact.id}`);
                      toast("Contact removed", "success");
                      onChange();
                    }}
                    className={cn(btn, "opacity-0 group-hover:opacity-100 hover:text-rose-500")}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ContactModal
        open={creating || Boolean(editing)}
        leadId={leadId}
        contact={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          onChange();
        }}
      />
    </Card>
  );
}

function ContactModal({
  open,
  leadId,
  contact,
  onClose,
  onSaved,
}: {
  open: boolean;
  leadId: number;
  contact: Contact | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    role: "",
    phone: "",
    email: "",
    notes: "",
    isPrimary: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: contact?.name ?? "",
      role: contact?.role ?? "",
      phone: contact?.phone ?? "",
      email: contact?.email ?? "",
      notes: contact?.notes ?? "",
      isPrimary: contact?.isPrimary ?? false,
    });
  }, [open, contact]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={contact ? "Edit contact" : "New contact"}
      size="sm"
      footer={
        <>
          <Button size="md" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="md"
            variant="primary"
            disabled={saving}
            onClick={async () => {
              if (!form.name.trim()) return toast("Name is required", "error");
              setSaving(true);
              try {
                if (contact) await apiPatch(`/api/contacts?id=${contact.id}`, form);
                else await apiPost("/api/contacts", { ...form, leadId });
                toast("Contact saved", "success");
                onSaved();
              } catch (error) {
                toast((error as Error).message, "error");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : "Save contact"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label>Name</Label>
          <Input
            value={form.name}
            placeholder="Ahmed"
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div>
          <Label>Role</Label>
          <Input
            value={form.role}
            placeholder="Owner / Manager / Marketing"
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Phone</Label>
            <Input
              value={form.phone}
              placeholder="+251…"
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <Label>Notes</Label>
          <textarea
            className="field min-h-[60px] resize-y"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Best reached in the morning…"
          />
        </div>
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={form.isPrimary}
            onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))}
            className="h-4 w-4 accent-[rgb(var(--accent))]"
          />
          Primary contact
        </label>
      </div>
    </Modal>
  );
}
