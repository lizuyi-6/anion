"use client";

import { startTransition, useMemo, useState } from "react";

import { createSession, uploadFiles } from "@/lib/client/api";
import { useRouter } from "@/lib/client/router";
import type { RolePackId, SessionConfig, UploadReference } from "@/lib/domain";
import { rolePacks } from "@/lib/domain";

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
    level: "资深",
    jobDescription: "",
    interviewers: rolePacks[defaultRolePack].interviewers.map((item) => item.id),
    materials: [],
    candidateName: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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

    try {
      setIsUploading(true);
      setError("");

      const uploads = await uploadFiles(files);
      setForm((current) => ({
        ...current,
        materials: [...current.materials, ...uploads],
      }));
    } catch (uploadError) {
      const errorMessage = uploadError instanceof Error ? uploadError.message : "上传失败";
      setError(`上传失败：${errorMessage}`);
      console.error("文件上传错误:", uploadError);
    } finally {
      setIsUploading(false);
    }
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (isUploading) {
      setError("材料仍在上传，请稍候再提交。");
      return;
    }

    if (form.targetCompany.trim().length < 2) {
      setError("目标公司名称至少需要 2 个字符。");
      return;
    }

    if (form.jobDescription.trim().length < 20) {
      setError("职位描述至少需要 20 个字符。");
      return;
    }

    if (form.interviewers.length === 0) {
      setError("请至少选择一位面试官。");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createSession(form);
      startTransition(() => {
        router.push(`/simulator/${result.sessionId}`);
      });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "创建失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitLabel = isUploading
    ? "材料上传中..."
    : isSubmitting
      ? "正在创建..."
      : "进入面试模拟器";

  return (
    <form className="stack-lg" onSubmit={onSubmit} data-testid="interview-setup-form">
      <div className="panel">
        <div className="section-head">
          <div>
            <p className="panel-label">A1 / 上下文初始化</p>
            <h3>目标画像设定</h3>
          </div>
        </div>
        <div className="grid-two">
          <label className="field">
            <span>目标公司</span>
            <input
              data-testid="target-company-input"
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
              data-testid="industry-input"
              value={form.industry}
              onChange={(event) =>
                setForm((current) => ({ ...current, industry: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>岗位级别</span>
            <select
              data-testid="level-input"
              value={form.level}
              onChange={(event) =>
                setForm((current) => ({ ...current, level: event.target.value }))
              }
              required
            >
              <option value="初级">初级 (Junior)</option>
              <option value="中级">中级 (Mid-level)</option>
              <option value="资深">资深 (Senior)</option>
              <option value="Staff">Staff</option>
              <option value="Principal">Principal</option>
              <option value="Director">Director</option>
            </select>
          </label>
          <label className="field">
            <span>候选人称呼</span>
            <input
              data-testid="candidate-name-input"
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
          <span>职位描述</span>
          <textarea
            data-testid="job-description-input"
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
            <p className="panel-label">角色包</p>
            <h3>能力包装</h3>
          </div>
        </div>
        <div className="card-grid" aria-label="角色包选择">
          {(Object.keys(rolePacks) as RolePackId[]).map((rolePackId) => {
            const item = rolePacks[rolePackId];
            const selected = form.rolePack === rolePackId;
            return (
              <button
                key={rolePackId}
                type="button"
                className="select-card"
                aria-pressed={selected}
                data-selected={selected ? "true" : "false"}
                onClick={() => onRolePackChange(rolePackId)}
              >
                {selected ? (
                  <span className="select-card-badge" aria-hidden="true">
                    已选中
                  </span>
                ) : null}
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
            <h3>面试官选择</h3>
          </div>
        </div>
        <div className="card-grid" aria-label="面试官选择">
          {pack.interviewers.map((interviewer) => {
            const checked = form.interviewers.includes(interviewer.id);
            return (
              <button
                key={interviewer.id}
                type="button"
                className="select-card"
                aria-pressed={checked}
                data-selected={checked ? "true" : "false"}
                onClick={() => toggleInterviewer(interviewer.id)}
              >
                {checked ? (
                  <span className="select-card-badge" aria-hidden="true">
                    已选中
                  </span>
                ) : null}
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
          <span>
            {isUploading
              ? "上传中..."
              : "上传简历、项目材料、日志或补充文档（支持 txt, csv, md, json, log, pdf, doc, docx）"}
          </span>
          <input
            type="file"
            multiple
            disabled={isUploading}
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

      <button
        type="submit"
        className="primary-button"
        disabled={isSubmitting || isUploading}
        data-testid="create-session-button"
      >
        {submitLabel}
      </button>
    </form>
  );
}
