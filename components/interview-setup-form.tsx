"use client";

import { useRouter } from "next/navigation";
import { startTransition, useMemo, useState } from "react";

import { createSession, uploadFiles } from "@/lib/client/api";
import type { RolePackId, SessionConfig, UploadReference } from "@/lib/domain";
import { rolePacks } from "@/lib/domain";

type FormState = Omit<SessionConfig, "materials"> & {
  materials: UploadReference[];
};

type SessionPrefill = Partial<
  Pick<
    SessionConfig,
    | "rolePack"
    | "targetCompany"
    | "industry"
    | "level"
    | "focusGoal"
    | "jobDescription"
    | "interviewers"
    | "candidateName"
  >
>;

const wizardSteps = [
  {
    id: "target",
    label: "目标岗位",
    description: "确认这轮准备面向哪个岗位、公司和级别。",
  },
  {
    id: "materials",
    label: "补充材料",
    description: "放进 JD、简历或作品信息，给后续模拟更多上下文。",
  },
  {
    id: "focus",
    label: "关注重点",
    description: "选择这轮最想重点练的能力和面试官组合。",
  },
] as const;

const levelOptions = ["初级", "中级", "资深", "Staff", "Principal", "Director"];

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function validateStep(step: number, form: FormState) {
  if (step === 0) {
    if (form.targetCompany.trim().length < 2) {
      return "目标公司名称至少需要 2 个字符。";
    }

    if (form.jobDescription.trim().length < 20) {
      return "岗位描述至少需要 20 个字符。";
    }
  }

  if (step === 2 && form.interviewers.length === 0) {
    return "请至少选择一位面试官。";
  }

  if (step === 2 && form.focusGoal.trim().length < 6) {
    return "请写清这轮最想压测的一条回答链路或能力短板。";
  }

  return "";
}

export function InterviewSetupForm({
  defaultRolePack,
  prefill,
}: {
  defaultRolePack: RolePackId;
  prefill?: SessionPrefill;
}) {
  const router = useRouter();
  const initialRolePack = prefill?.rolePack ?? defaultRolePack;
  const [form, setForm] = useState<FormState>({
    rolePack: initialRolePack,
    targetCompany: prefill?.targetCompany ?? "",
    industry: prefill?.industry ?? "",
    level: prefill?.level ?? "资深",
    focusGoal: prefill?.focusGoal ?? "",
    jobDescription: prefill?.jobDescription ?? "",
    interviewers:
      prefill?.interviewers?.length
        ? prefill.interviewers
        : rolePacks[initialRolePack].interviewers.map((item) => item.id),
    materials: [],
    candidateName: prefill?.candidateName ?? "",
  });
  const [step, setStep] = useState(0);
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
      setError(`上传失败: ${errorMessage}`);
      console.error("文件上传错误:", uploadError);
    } finally {
      setIsUploading(false);
    }
  };

  const removeMaterial = (materialId: string) => {
    setForm((current) => ({
      ...current,
      materials: current.materials.filter((item) => item.id !== materialId),
    }));
  };

  const goNext = () => {
    const validationError = validateStep(step, form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError("");
    setStep((current) => Math.min(current + 1, wizardSteps.length - 1));
  };

  const goBack = () => {
    setError("");
    setStep((current) => Math.max(current - 1, 0));
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (isUploading) {
      setError("材料仍在上传，请稍后再提交。");
      return;
    }

    const validationError = validateStep(0, form) || validateStep(2, form);
    if (validationError) {
      setError(validationError);
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
      : "进入模拟训练";
  const isLastStep = step === wizardSteps.length - 1;

  return (
    <form className="stack-lg" onSubmit={onSubmit} data-testid="interview-setup-form">
      <section className="panel">
        <div className="section-head">
          <div>
            <p className="panel-label">准备流程</p>
            <h3>三步完成这轮准备目标</h3>
          </div>
        </div>
        <div className="journey-wizard-track">
          {wizardSteps.map((item, index) => {
            const state = index < step ? "done" : index === step ? "active" : "upcoming";
            return (
              <button
                key={item.id}
                type="button"
                className={`journey-wizard-step ${state}`}
                onClick={() => {
                  if (index <= step) {
                    setStep(index);
                    setError("");
                  }
                }}
              >
                <span>{`${index + 1}. ${item.label}`}</span>
                <strong>{item.description}</strong>
              </button>
            );
          })}
        </div>
      </section>

      <div className="journey-form-layout">
        <div className="journey-form-main">
          {step === 0 ? (
            <section className="panel">
              <div className="section-head">
                <div>
                  <p className="panel-label">第一步</p>
                  <h3>先说清楚这轮准备面向什么岗位</h3>
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
                    placeholder="例如: Stripe"
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
                    placeholder="例如: Fintech / AI Infra"
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
                    {levelOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
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
                    placeholder="默认显示为“候选人”"
                  />
                </label>
              </div>
              <label className="field">
                <span>岗位描述 / 这轮准备背景</span>
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
                  placeholder="写下 JD、核心职责、面试关注点，或你最担心被问到的部分。"
                  required
                />
              </label>
            </section>
          ) : null}

          {step === 1 ? (
            <section className="panel">
              <div className="section-head">
                <div>
                  <p className="panel-label">第二步</p>
                  <h3>补充已有材料，给后续模拟更多上下文</h3>
                </div>
              </div>
              <p className="hero-copy">
                这一步可以上传简历、JD、作品集或任何你希望系统参考的材料。没有材料也可以直接跳过。
              </p>
              <label className="upload-box">
                <span>{isUploading ? "正在上传..." : "选择文件 (PDF / DOCX / TXT / MD)"}</span>
                <input
                  type="file"
                  multiple
                  onChange={(event) => {
                    void onUpload(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>

              {form.materials.length > 0 ? (
                <div className="material-list">
                  {form.materials.map((material) => (
                    <article key={material.id} className="upload-item">
                      <div>
                        <strong>{material.originalName}</strong>
                        <p className="muted-copy">
                          {material.mimeType} · {formatFileSize(material.size)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="inline-button secondary-button"
                        onClick={() => removeMaterial(material.id)}
                      >
                        移除
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="journey-note-card">
                  <strong>还没有添加材料</strong>
                  <p className="muted-copy">
                    没关系。先创建目标也可以，后续模拟和行动计划仍然能跑通。
                  </p>
                </div>
              )}
            </section>
          ) : null}

          {step === 2 ? (
            <section className="panel">
              <div className="section-head">
                <div>
                  <p className="panel-label">第三步</p>
                  <h3>决定这轮最想重点练什么</h3>
                </div>
              </div>
              <div className="stack-md">
                <div>
                  <p className="panel-label">角色包</p>
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
                          <span className="eyebrow">
                            {rolePackId === "engineering" ? "默认优先" : "可选扩展"}
                          </span>
                          <strong>{item.label}</strong>
                          <p>{item.summary}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="field">
                  <span>本轮重点压测目标</span>
                  <textarea
                    data-testid="focus-goal-input"
                    rows={4}
                    value={form.focusGoal}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        focusGoal: event.target.value,
                      }))
                    }
                    placeholder="例如：被打断后仍能在 60 秒内给出结论、证据和代价；或把技术取舍讲到 owner / 风险 / business impact。"
                  />
                </label>

                <div>
                  <p className="panel-label">面试官组合</p>
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
                          <strong>{interviewer.label}</strong>
                          <p>{interviewer.title}</p>
                          <p>{interviewer.style}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {error ? <p className="error-copy">{error}</p> : null}

          <div className="wizard-nav-row">
            <button
              type="button"
              className="secondary-button"
              disabled={step === 0 || isSubmitting}
              onClick={goBack}
            >
              上一步
            </button>
            {isLastStep ? (
              <button
                type="submit"
                className="primary-button"
                disabled={isSubmitting || isUploading}
                data-testid="create-session-button"
              >
                {submitLabel}
              </button>
            ) : (
              <button
                type="button"
                className="primary-button"
                disabled={isUploading}
                onClick={goNext}
              >
                下一步
              </button>
            )}
          </div>
        </div>

        <aside className="journey-form-aside">
          <article className="workspace-card">
            <div className="section-head">
              <div>
                <p className="panel-label">当前摘要</p>
                <h3>{form.targetCompany || "还未填写目标公司"}</h3>
              </div>
            </div>
            <div className="journey-summary-list">
              <div className="journey-summary-item">
                <strong>岗位级别</strong>
                <span>{form.level}</span>
              </div>
              <div className="journey-summary-item">
                <strong>默认角色</strong>
                <span>{rolePacks[form.rolePack].label}</span>
              </div>
              <div className="journey-summary-item">
                <strong>材料数量</strong>
                <span>{form.materials.length} 份</span>
              </div>
              <div className="journey-summary-item">
                <strong>压测目标</strong>
                <span>{form.focusGoal.trim() || "还未填写"}</span>
              </div>
              <div className="journey-summary-item">
                <strong>面试官</strong>
                <span>{form.interviewers.length} 位</span>
              </div>
            </div>
          </article>

          <article className="workspace-card">
            <div className="section-head">
              <div>
                <p className="panel-label">为什么这样设计</p>
                <h3>先说目标，再补材料，最后决定重点</h3>
              </div>
            </div>
            <p className="muted-copy">
              先把这轮要准备什么说清楚，比一上来面对一整页配置项更重要。完成这三步后，系统会直接把你带进模拟训练。
            </p>
          </article>
        </aside>
      </div>
    </form>
  );
}
