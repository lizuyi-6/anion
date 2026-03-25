"use client";

import { useRouter } from "next/navigation";
import { startTransition, useMemo, useState } from "react";

import type { RolePackId, SessionConfig, UploadReference } from "@/lib/domain";
import { rolePacks } from "@/lib/domain";
import { createSession, uploadFiles } from "@/lib/client/api";

type FormState = Omit<SessionConfig, "materials"> & {
  materials: UploadReference[];
};

export function InterviewSetupForm({
  defaultRolePack,
}: {
  defaultRolePack: RolePackId;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    rolePack: defaultRolePack,
    targetCompany: "",
    industry: "",
    level: "Senior",
    jobDescription: "",
    interviewers: rolePacks[defaultRolePack].interviewers.map((item) => item.id),
    materials: [],
    candidateName: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const pack = useMemo(() => rolePacks[form.rolePack], [form.rolePack]);

  const toggleInterviewer = (interviewerId: string) => {
    setForm((current) => {
      const exists = current.interviewers.includes(interviewerId);
      const next = exists
        ? current.interviewers.filter((item) => item !== interviewerId)
        : [...current.interviewers, interviewerId];

      return {
        ...current,
        interviewers: next.length > 0 ? next : [interviewerId],
      };
    });
  };

  const onRolePackChange = (rolePack: RolePackId) => {
    setForm((current) => ({
      ...current,
      rolePack,
      interviewers: rolePacks[rolePack].interviewers.map((item) => item.id),
    }));
    document.cookie = `mobius-role-pack=${rolePack}; path=/; max-age=31536000`;
  };

  const onUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const uploads = await uploadFiles(files);
    setForm((current) => ({
      ...current,
      materials: [...current.materials, ...uploads],
    }));
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await createSession(form);
      startTransition(() => {
        router.push(`/simulator/${result.sessionId}`);
      });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "创建失败",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="stack-lg" onSubmit={onSubmit}>
      <div className="panel">
        <div className="section-head">
          <div>
            <p className="panel-label">A1 / 上下文初始化</p>
            <h3>目标物设定</h3>
          </div>
        </div>
        <div className="grid-two">
          <label className="field">
            <span>目标公司 / 机构</span>
            <input
              value={form.targetCompany}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  targetCompany: event.target.value,
                }))
              }
              required
            />
          </label>
          <label className="field">
            <span>行业</span>
            <input
              value={form.industry}
              onChange={(event) =>
                setForm((current) => ({ ...current, industry: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>岗位级别</span>
            <input
              value={form.level}
              onChange={(event) =>
                setForm((current) => ({ ...current, level: event.target.value }))
              }
              required
            />
          </label>
          <label className="field">
            <span>候选人称呼</span>
            <input
              value={form.candidateName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  candidateName: event.target.value,
                }))
              }
            />
          </label>
        </div>
        <label className="field">
          <span>JD / 职位描述</span>
          <textarea
            value={form.jobDescription}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                jobDescription: event.target.value,
              }))
            }
            rows={8}
            required
          />
        </label>
      </div>

      <div className="panel">
        <div className="section-head">
          <div>
            <p className="panel-label">Role Packs</p>
            <h3>能力包装</h3>
          </div>
        </div>
        <div className="card-grid">
          {(Object.keys(rolePacks) as RolePackId[]).map((rolePackId) => {
            const item = rolePacks[rolePackId];
            return (
              <button
                key={rolePackId}
                type="button"
                className={`select-card ${form.rolePack === rolePackId ? "selected" : ""}`}
                onClick={() => onRolePackChange(rolePackId)}
              >
                <strong>{item.label}</strong>
                <p>{item.summary}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <div className="section-head">
          <div>
            <p className="panel-label">面试官矩阵</p>
            <h3>面试官矩阵选择</h3>
          </div>
        </div>
        <div className="card-grid">
          {pack.interviewers.map((interviewer) => {
            const checked = form.interviewers.includes(interviewer.id);
            return (
              <button
                key={interviewer.id}
                type="button"
                className={`select-card ${checked ? "selected" : ""}`}
                onClick={() => toggleInterviewer(interviewer.id)}
              >
                <span className="eyebrow">{interviewer.title}</span>
                <strong>{interviewer.label}</strong>
                <p>{interviewer.style}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <div className="section-head">
          <div>
            <p className="panel-label">材料</p>
            <h3>候选人材料</h3>
          </div>
        </div>
        <label className="upload-box">
          <span>上传简历、项目材料、日志或补充文档</span>
          <input
            type="file"
            multiple
            onChange={(event) => {
              void onUpload(event.target.files);
            }}
          />
        </label>
        {form.materials.length > 0 ? (
          <div className="chip-row">
            {form.materials.map((item) => (
              <span key={item.id} className="status-pill subtle">
                {item.originalName}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {error ? <p className="error-copy">{error}</p> : null}

      <button type="submit" className="primary-button" disabled={isSubmitting}>
        {isSubmitting ? "正在创建..." : "进入面试模拟器"}
      </button>
    </form>
  );
}
