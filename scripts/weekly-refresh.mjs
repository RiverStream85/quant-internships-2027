import fs from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const DATA_URL = new URL("quant_internships_2027.json", ROOT);
const REPORT_URL = new URL("quant_internships_2027.md", ROOT);
const HTML_URL = new URL("index.html", ROOT);
const AS_OF = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const UPDATE_SCHEDULE = "Every Monday at 10:17 AM Asia/Shanghai";
const INTERNATLAS_URL = "https://raw.githubusercontent.com/sonak11/internatlas/main/generated/exports/internships.json";

const boards = [
  { company: "Akuna Capital", ats: "greenhouse", token: "akunacapital" },
  { company: "AQR Capital Management", ats: "greenhouse", token: "aqr" },
  { company: "Aquatic", ats: "greenhouse", token: "aquaticcapitalmanagement" },
  { company: "Belvedere Trading", ats: "lever", token: "belvederetrading" },
  { company: "BlackEdge Capital", ats: "greenhouse", token: "blackedgecapital" },
  { company: "Chicago Trading Company", ats: "greenhouse", token: "chicagotradingcampus" },
  { company: "Chicago Trading Company", ats: "greenhouse", token: "ctccampusboard" },
  { company: "Cubist (Point72)", ats: "greenhouse", token: "point72" },
  { company: "DRW", ats: "greenhouse", token: "drweng" },
  { company: "DV Trading", ats: "greenhouse", token: "dvtrading" },
  { company: "Five Rings", ats: "greenhouse", token: "fiveringsllc" },
  { company: "Flow Traders", ats: "greenhouse", token: "flowtraders" },
  { company: "Hudson River Trading", ats: "greenhouse", token: "wehrtyou" },
  { company: "IMC Trading", ats: "greenhouse", token: "imc" },
  { company: "Jane Street", ats: "greenhouse", token: "janestreet" },
  { company: "Jump Trading", ats: "greenhouse", token: "jumptrading" },
  { company: "Marshall Wace", ats: "greenhouse", token: "mwinternshipprogram" },
  { company: "Maven Securities", ats: "greenhouse", token: "mavensecuritiesholdingltd" },
  { company: "Maven Securities", ats: "greenhouse", token: "emergingtalent" },
  { company: "Old Mission Capital", ats: "greenhouse", token: "oldmissioncapital" },
  { company: "Optiver", ats: "greenhouse", token: "optiverprivate" },
  { company: "PDT Partners", ats: "greenhouse", token: "pdtpartners" },
  { company: "Radix Trading", ats: "greenhouse", token: "radixuniversity" },
  { company: "Tower Research Capital", ats: "greenhouse", token: "towerresearchcapital" },
  { company: "TransMarket Group", ats: "greenhouse", token: "transmarketgroup" },
  { company: "Two Sigma", ats: "greenhouse", token: "twosigma" },
  { company: "VIRTU Financial", ats: "greenhouse", token: "virtu" },
  { company: "The Voleon Group", ats: "lever", token: "voleon" },
  { company: "Walleye Capital", ats: "greenhouse", token: "walleyecapital-external-students" },
  { company: "Xantium", ats: "greenhouse", token: "xantium" },
];

const aliases = new Map([
  ["blackedgecapital", "BlackEdge Capital"],
  ["chicagotradingcompanyctc", "Chicago Trading Company"],
  ["cubistsystematicstrategies", "Cubist (Point72)"],
  ["deshaw", "D. E. Shaw"],
  ["imc", "IMC Trading"],
  ["oldmission", "Old Mission Capital"],
  ["point72", "Cubist (Point72)"],
  ["susquehannainternationalgroup", "SIG"],
  ["trillium", "Trillium Trading"],
  ["virtufinancial", "VIRTU Financial"],
  ["voleon", "The Voleon Group"],
  ["voloridge", "Voloridge Investment Management"],
]);

function normalize(value = "") {
  return String(value).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
}

function stripHtml(value = "") {
  return String(value)
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|li|h\d)>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&ndash;|&#8211;/g, "–")
    .replace(/&mdash;|&#8212;/g, "—")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchJson(url, attempts = 1) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(45000),
        headers: { accept: "application/json", "user-agent": "quant-internship-tracker-weekly-audit/1.0" },
      });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function classifySeason(title, body = "", explicitSeason = "") {
  const source = `${title} ${body}`;
  if (["8445018002", "6426915002", "8551689002"].some((id) => source.includes(id))) return "Winter 2027";
  if (/winter|winternship/i.test(explicitSeason)) return "Winter 2027";
  if (/summer/i.test(explicitSeason)) return "Summer 2027";
  const summer = /summer\s*(?:internship|analyst|program|programme)?[^.]{0,35}2027|2027[^.]{0,35}summer|June\s+2027|May\s*\/\s*June\s+2027/i.test(source);
  const winter = /winternship|winter\s*(?:quarter|internship|program|programme)?[^.]{0,35}2027|2027[^.]{0,35}winter|starting January 2027|January to April 2027/i.test(source);
  if (summer && winter) return "Winter + Summer 2027";
  if (winter) return "Winter 2027";
  if (summer) return "Summer 2027";
  return "";
}

function isQuantRelevant(title = "") {
  if (/legal|human resources|people operations|business development|finance\s*(?:&|and)\s*accounting|administrative|marketing|recruit/i.test(title)) return false;
  return /intern|summer analyst|winternship|wintership|fellowship/i.test(title)
    && /quant|trader|trading|research|software|developer|engineer|hardware|fpga|asic|machine learning|\bml\b|\bai\b|data|strategy|risk|portfolio|technology|analyst|intern|winternship/i.test(title);
}

function isWomenFocused(title = "", body = "") {
  const opening = body.slice(0, 5000);
  return /women(?:'s|s)?\b|winternship|witti/i.test(title)
    || /exceptional female talent|designed (?:specifically )?for women|open to (?:female|women)|women(?: and| or) non[- ]binary|female (?:students|candidates|undergraduates)|women in (?:trading|technology|finance)/i.test(opening);
}

function roleFamily(title = "", category = "") {
  const source = `${category} ${title}`;
  if (/winternship/i.test(source)) return "Quant Trading";
  if (/fpga|asic|hardware/i.test(source)) return "Hardware / FPGA";
  if (/software|developer|development|engineer|swe|systems|platform|network|cloud|cyber|data engineering|devops|sre/i.test(source)) return "Software / Quant Dev";
  if (/research|researcher|machine learning|\bml\b|data science|\bai\b|nlp|strategist|strategy/i.test(source)) return "Quant Research / Strategy";
  if (/trader|trading|\bqt\b/i.test(source)) return "Quant Trading";
  if (/risk|portfolio|analyst/i.test(source)) return "Risk / Analytics";
  return "Other Quant Internship";
}

function compactLocation(locations = []) {
  const values = [];
  for (const item of locations) {
    const value = [item.city, item.state].filter(Boolean).join(", ") || item.country || "";
    if (value && !values.some((current) => normalize(current) === normalize(value))) values.push(value);
  }
  return values.join("; ") || "See application";
}

function deadlineFromText(text = "") {
  const labelled = text.match(/Application Deadline\s*:\s*(.{3,180})/i)?.[1] || "";
  const date = labelled.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?[,]?\s*\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?[,]?\s+20\d{2}/i)?.[0];
  if (date) return date.trim();
  if (/rolling/i.test(labelled)) return "Rolling review; apply promptly";
  return "Not stated; apply promptly";
}

function datesFromText(season, text = "", jobId = "") {
  if (jobId === "8445018002") return "January 11–15, 2027";
  if (["6426915002", "8551689002"].includes(jobId)) return "January 4–8, 2027";
  const range = text.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?[^.;]{0,70}2027/i)?.[0];
  if (range) return range.trim();
  const duration = text.match(/\b(\d{1,2})[ -](week|month)(?:s)?\b/i);
  if (duration) return `${season}; ${duration[1]} ${duration[2].toLowerCase()}${duration[1] === "1" ? "" : "s"}; exact calendar dates not stated`;
  return `${season}; exact program dates not stated`;
}

function idFromUrl(url = "") {
  return String(url).match(/(?:gh_jid=|jobs?\/|JobDetail\/|token=)(\d{5,})/i)?.[1]
    || String(url).match(/\b(\d{7,})\b/)?.[1]
    || String(url).match(/jobs\.lever\.co\/[^/]+\/([a-f0-9-]{20,})/i)?.[1]
    || "";
}

function rowKey(row) {
  const id = idFromUrl(row.applicationUrl);
  if (id) return `${normalize(row.company)}:id:${id}`;
  const canonical = String(row.applicationUrl || "").replace(/\/apply\/?(?:\?.*)?$/i, "").replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
  return `${normalize(row.company)}:url:${canonical}`;
}

function semanticKey(row) {
  const title = normalize(String(row.title || "").replace(/\b(?:campus|summer|winter|quarter|2027|internship|intern)\b/gi, ""));
  return `${normalize(row.company)}:${normalize(row.season)}:${title}:${normalize(row.location)}`;
}

async function collectOfficialBoards() {
  const checks = await Promise.all(boards.map(async (board) => {
    try {
      if (board.ats === "greenhouse") {
        const payload = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${board.token}/jobs?content=true`);
        return {
          board,
          ok: true,
          count: payload.jobs.length,
          rows: payload.jobs.map((job) => ({
            company: board.company,
            title: stripHtml(job.title),
            body: stripHtml(job.content || ""),
            location: job.location?.name || "See application",
            applicationUrl: job.absolute_url,
            jobId: String(job.id),
            updatedAt: job.updated_at || "",
            source: `Official Greenhouse board (${board.token})`,
          })),
        };
      }
      const payload = await fetchJson(`https://api.lever.co/v0/postings/${board.token}?mode=json`);
      return {
        board,
        ok: true,
        count: payload.length,
        rows: payload.map((job) => ({
          company: board.company,
          title: stripHtml(job.text),
          body: stripHtml(`${job.descriptionPlain || ""} ${job.additionalPlain || ""}`),
          location: job.categories?.location || "See application",
          applicationUrl: job.applyUrl || job.hostedUrl,
          jobId: String(job.id),
          updatedAt: job.createdAt ? new Date(job.createdAt).toISOString() : "",
          source: `Official Lever board (${board.token})`,
        })),
      };
    } catch (error) {
      return { board, ok: false, count: 0, rows: [], error: String(error) };
    }
  }));
  const successes = checks.filter((row) => row.ok).length;
  if (successes < 18) throw new Error(`Only ${successes} of ${boards.length} official ATS boards responded; refusing to publish a partial refresh.`);
  return { checks, allRows: checks.flatMap((row) => row.rows), successes };
}

function openingFromBoard(row) {
  const season = classifySeason(`${row.title} ${row.jobId}`, row.body);
  if (!season || !isQuantRelevant(row.title)) return null;
  return {
    company: row.company,
    season,
    roleFamily: roleFamily(row.title),
    title: row.title,
    location: row.location,
    programDates: datesFromText(season, row.body, row.jobId),
    applicationDeadline: deadlineFromText(row.body),
    status: "Open — official ATS application live",
    applicationUrl: row.applicationUrl,
    traderMathJobUrl: "",
    discoverySource: row.source,
    verificationNote: `Live on the firm's official ATS when rechecked${row.updatedAt ? `; posting updated ${row.updatedAt.slice(0, 10)}` : ""}`,
    checkedAsOf: AS_OF,
    _priority: 8,
  };
}

async function collectInternAtlas(data) {
  const payload = await fetchJson(INTERNATLAS_URL, 3);
  if (!Array.isArray(payload.internships)) throw new Error("InternAtlas export did not contain an internships array.");
  const firmNames = new Map(data.directory.map((firm) => [normalize(firm.name), firm.name]));
  const canonicalCompany = (value) => aliases.get(normalize(value)) || firmNames.get(normalize(value)) || null;
  return {
    generated: payload.generated || "",
    rows: payload.internships.flatMap((row) => {
      if (row.year !== 2027 || row.status !== "open") return [];
      const company = canonicalCompany(row.company?.name || "");
      const season = classifySeason(row.role || "", "", row.season || "");
      if (!company || !season || !isQuantRelevant(row.role || "")) return [];
      return [{
        company,
        season,
        roleFamily: roleFamily(row.role, row.category),
        title: row.role || "Internship",
        location: compactLocation(row.locations),
        programDates: `${season}; exact program dates not stated`,
        applicationDeadline: row.dates?.deadline || "Not stated; apply promptly",
        status: "Open — current official application link",
        applicationUrl: row.apply_url,
        traderMathJobUrl: "",
        discoverySource: "InternAtlas current ATS cross-check + official application URL",
        verificationNote: `Listed as open for ${season}; last verified ${row.dates?.last_verified || AS_OF}`,
        checkedAsOf: AS_OF,
        _priority: 6,
      }];
    }),
  };
}

async function checkUrl(url) {
  if (!/^https?:\/\//i.test(url || "")) return { state: "invalid", status: 0 };
  try {
    let response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
      headers: { "user-agent": "Mozilla/5.0 quant-internship-link-check/1.0" },
    });
    if ([404, 405, 410].includes(response.status)) {
      response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(20000),
        headers: { range: "bytes=0-2048", "user-agent": "Mozilla/5.0 quant-internship-link-check/1.0" },
      });
      await response.body?.cancel();
    }
    return { state: [404, 410].includes(response.status) ? "gone" : "reachable", status: response.status };
  } catch (error) {
    return { state: "unknown", status: 0, error: String(error) };
  }
}

async function checkUrls(urls, concurrency = 14) {
  const unique = [...new Set(urls.filter(Boolean))];
  const results = new Map();
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, async () => {
    while (cursor < unique.length) {
      const index = cursor++;
      results.set(unique[index], await checkUrl(unique[index]));
    }
  }));
  return results;
}

function mergeRows(existingRows, discoveredRows) {
  const candidates = [
    ...existingRows.map((row) => ({ ...row, checkedAsOf: AS_OF, _priority: 4 })),
    ...discoveredRows,
  ];
  const byKey = new Map();
  for (const row of candidates) {
    const key = rowKey(row);
    const previous = byKey.get(key);
    if (!previous) {
      byKey.set(key, row);
      continue;
    }
    const preferred = (row._priority || 0) > (previous._priority || 0) ? { ...row } : { ...previous };
    const secondary = preferred.applicationUrl === row.applicationUrl && preferred._priority === row._priority ? previous : row;
    if ((!preferred.location || /see application/i.test(preferred.location)) && secondary.location) preferred.location = secondary.location;
    if ((!preferred.programDates || /exact program dates not stated/i.test(preferred.programDates)) && secondary.programDates && !/exact program dates not stated/i.test(secondary.programDates)) preferred.programDates = secondary.programDates;
    if ((!preferred.applicationDeadline || /not stated/i.test(preferred.applicationDeadline)) && secondary.applicationDeadline && !/not stated/i.test(secondary.applicationDeadline)) preferred.applicationDeadline = secondary.applicationDeadline;
    if (!preferred.traderMathJobUrl && secondary.traderMathJobUrl) preferred.traderMathJobUrl = secondary.traderMathJobUrl;
    preferred.discoverySource = [...new Set(
      [preferred.discoverySource, secondary.discoverySource]
        .filter(Boolean)
        .flatMap((source) => source.split(/;\s*/))
        .filter(Boolean),
    )].join("; ");
    byKey.set(key, preferred);
  }
  const semantic = new Map();
  for (const row of [...byKey.values()].sort((a, b) => (b._priority || 0) - (a._priority || 0))) {
    if (!semantic.has(semanticKey(row))) semantic.set(semanticKey(row), row);
  }
  return [...semantic.values()]
    .map(({ _priority, ...row }) => row)
    .sort((a, b) => a.company.localeCompare(b.company) || a.season.localeCompare(b.season) || a.roleFamily.localeCompare(b.roleFamily) || a.title.localeCompare(b.title));
}

function rebuildWomenPrograms(data, boardRows, linkChecks, openings) {
  const firmUrl = (company) => data.directory.find((firm) => firm.name === company)?.traderMathUrl || "https://www.tradermath.org/practice/firms";
  let programs = (data.womenPrograms || []).map((row) => ({ ...row, checkedAsOf: AS_OF }));

  const virtuRows = boardRows
    .filter((row) => row.company === "VIRTU Financial" && /women.*winternship|winternship/i.test(row.title) && classifySeason(`${row.title} ${row.jobId}`, row.body) === "Winter 2027")
    .sort((a, b) => a.location.localeCompare(b.location));
  const existingVirtu = programs.find((row) => row.company === "VIRTU Financial" && /Winternship/i.test(row.title));
  if (virtuRows.length) {
    const applications = virtuRows.map((row) => ({
      label: row.location,
      url: row.applicationUrl,
      dates: datesFromText("Winter 2027", row.body, row.jobId),
      deadline: deadlineFromText(row.body),
    }));
    const virtu = {
      ...existingVirtu,
      company: "VIRTU Financial",
      title: "Women's Winternship",
      category: "Winternship",
      season: "Winter 2027",
      location: applications.map((row) => row.label).join("; "),
      programDates: applications.map((row) => `${row.label}: ${row.dates}`).join("; "),
      applicationDeadline: applications.map((row) => `${row.label}: ${row.deadline}`).join("; "),
      status: `Open — ${applications.length} official location application${applications.length === 1 ? "" : "s"} live`,
      applicationUrl: "https://job-boards.greenhouse.io/virtu",
      applications,
      traderMathUrl: firmUrl("VIRTU Financial"),
      verificationNote: `One program with ${applications.length} separately posted location application${applications.length === 1 ? "" : "s"}.`,
      checkedAsOf: AS_OF,
    };
    programs = [virtu, ...programs.filter((row) => row !== existingVirtu && !(row.company === "VIRTU Financial" && /Winternship/i.test(row.title)))];
  }

  const hrtRow = boardRows.find((row) => row.company === "Hudson River Trading" && isWomenFocused(row.title, row.body) && classifySeason(row.title, row.body));
  if (hrtRow) {
    const index = programs.findIndex((row) => row.company === "Hudson River Trading" && /WiTTI|Women in Trading/i.test(row.title));
    const replacement = {
      ...(index >= 0 ? programs[index] : {}),
      company: "Hudson River Trading",
      title: hrtRow.title,
      category: "Women-focused winter internship",
      season: classifySeason(hrtRow.title, hrtRow.body),
      location: hrtRow.location,
      programDates: datesFromText("Winter 2027", hrtRow.body, hrtRow.jobId),
      applicationDeadline: deadlineFromText(hrtRow.body),
      status: "Open — official HRT application live",
      applicationUrl: hrtRow.applicationUrl,
      traderMathUrl: firmUrl("Hudson River Trading"),
      verificationNote: "Official HRT ATS application verified live during the weekly audit.",
      checkedAsOf: AS_OF,
    };
    if (index >= 0) programs[index] = replacement;
    else programs.push(replacement);
  }

  programs = programs.map((row) => {
    const links = row.applications?.length ? row.applications.map((item) => item.url) : [row.applicationUrl];
    const allGone = links.length && links.every((url) => linkChecks.get(url)?.state === "gone");
    if (allGone && row.status?.startsWith("Open")) {
      return { ...row, status: "Monitor — prior application page is no longer live", verificationNote: "The prior application URL returned 404/410 in the weekly audit.", checkedAsOf: AS_OF };
    }
    return row;
  });

  const openWomenUrls = new Set(programs.flatMap((row) => row.applications?.map((item) => item.url) || [row.applicationUrl]));
  for (const opening of openings) {
    if (/women|winternship|witti/i.test(opening.title) && !openWomenUrls.has(opening.applicationUrl)) {
      programs.push({
        company: opening.company,
        title: opening.title,
        category: "Women-focused internship or insight program",
        season: opening.season,
        location: opening.location,
        programDates: opening.programDates,
        applicationDeadline: opening.applicationDeadline,
        eligibility: "See official application",
        status: opening.status,
        applicationUrl: opening.applicationUrl,
        traderMathUrl: firmUrl(opening.company),
        verificationNote: opening.verificationNote,
        checkedAsOf: AS_OF,
      });
    }
  }
  return programs;
}

function rebuildDirectory(data, openings, reviewQueue) {
  const byFirm = new Map();
  for (const row of openings) {
    if (!byFirm.has(row.company)) byFirm.set(row.company, []);
    byFirm.get(row.company).push(row);
  }
  const reviewCounts = reviewQueue.reduce((counts, row) => counts.set(row.company, (counts.get(row.company) || 0) + 1), new Map());
  return data.directory.map((firm) => {
    const rows = byFirm.get(firm.name) || [];
    const summer = rows.filter((row) => row.season.includes("Summer"));
    const winter = rows.filter((row) => row.season.includes("Winter"));
    return {
      ...firm,
      summerStatus: summer.length ? `Open — ${summer.length} verified role${summer.length === 1 ? "" : "s"}` : "No verified 2027 summer opening found",
      winterStatus: winter.length ? `Open — ${winter.length} verified role${winter.length === 1 ? "" : "s"}` : "No verified 2027 winter opening found",
      summerFirstApplicationUrl: summer[0]?.applicationUrl || "",
      winterFirstApplicationUrl: winter[0]?.applicationUrl || "",
      openRoleCount: rows.length,
      unclear2027Count: reviewCounts.get(firm.name) || 0,
      verificationScope: rows.length ? "At least one current official application page was verified through a primary source or current ATS cross-check" : "No verified 2027 summer/winter opening found in the expanded source audit",
      checkedAsOf: AS_OF,
    };
  });
}

function md(value = "") {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
}

function markdownLink(label, url) {
  return url ? `[${md(label)}](${url})` : md(label);
}

function statusCell(status, url) {
  return status?.startsWith("Open") ? markdownLink(status.replace("Open — ", "Open · "), url) : md(status);
}

function buildMarkdown(data) {
  const firmsWithOpenings = data.directory.filter((firm) => firm.openRoleCount > 0);
  const openingsByFirm = new Map();
  for (const row of data.openings) {
    if (!openingsByFirm.has(row.company)) openingsByFirm.set(row.company, []);
    openingsByFirm.get(row.company).push(row);
  }
  const lines = [
    "# Quant Summer & Winter Internship Tracker — 2027",
    "",
    `**Last successful check:** ${data.asOf} · **Automatic refresh:** ${data.updateSchedule} · **TraderMath firms checked:** ${data.directory.length} · **Firms with verified open roles:** ${firmsWithOpenings.length} · **Open role links:** ${data.openings.length}`,
    "",
    "> “Open” means an official application page or official application redirect was live when checked. “No verified opening found” is not the same as confirmed closed.",
    "",
    "## Companies with verified open 2027 roles",
    "",
    "| Company | Summer 2027 | Winter 2027 | Interview lean | TraderMath interview page |",
    "|---|---|---|---|---|",
  ];
  for (const firm of firmsWithOpenings) lines.push(`| ${md(firm.name)} | ${statusCell(firm.summerStatus, firm.summerFirstApplicationUrl)} | ${statusCell(firm.winterStatus, firm.winterFirstApplicationUrl)} | ${md(firm.classification)} | ${markdownLink("Guide", firm.traderMathUrl)} |`);
  lines.push("", "## Women’s programs", "", "| Company | Program | Status | Dates | Location | Deadline | Apply / monitor |", "|---|---|---|---|---|---|---|");
  for (const row of data.womenPrograms || []) {
    const applications = row.applications?.length ? row.applications.map((item) => markdownLink(item.label, item.url)).join(" · ") : markdownLink(row.status.startsWith("Open") ? "Apply" : "Monitor", row.applicationUrl);
    lines.push(`| ${md(row.company)} | ${md(row.title)} | ${md(row.status)} | ${md(row.programDates)} | ${md(row.location)} | ${md(row.applicationDeadline)} | ${applications} |`);
  }
  lines.push("", "## Detailed open applications", "");
  for (const firm of firmsWithOpenings) {
    lines.push(`### ${firm.name}`, "", `**Interview lean:** ${md(firm.classification)}. ${md(firm.summary)} ${markdownLink("TraderMath interview page", firm.traderMathUrl)}.`, "", "| Season | Role | Location | Program dates | Deadline | Application |", "|---|---|---|---|---|---|");
    for (const row of openingsByFirm.get(firm.name) || []) lines.push(`| ${md(row.season)} | ${md(row.title)} | ${md(row.location)} | ${md(row.programDates)} | ${md(row.applicationDeadline)} | ${markdownLink("Apply", row.applicationUrl)} |`);
    lines.push("");
  }
  lines.push("## Exhaustive TraderMath firm directory", "", `All ${data.directory.length} firms below come from TraderMath’s firm directory.`, "", "| Company | Summer 2027 status | Winter 2027 status | Interview lean | Brief TraderMath-based interview style | TraderMath page |", "|---|---|---|---|---|---|");
  for (const firm of data.directory) lines.push(`| ${md(firm.name)} | ${statusCell(firm.summerStatus, firm.summerFirstApplicationUrl)} | ${statusCell(firm.winterStatus, firm.winterFirstApplicationUrl)} | ${md(firm.classification)} | ${md(firm.summary)} | ${markdownLink("Interview guide", firm.traderMathUrl)} |`);
  lines.push("", "## Methodology and caveats", "", `- **Update schedule:** ${data.updateSchedule}. The date at the top is changed only after a successful automated audit.`, "", `- **Coverage:** all ${data.directory.length} TraderMath firms remain in the company universe. The latest audit attempted ${data.audit.officialAtsBoardsAttempted} official ATS boards and received ${data.audit.officialAtsBoardsSucceeded} successful responses.`, "", "- **Dates:** exact start/end dates and deadlines are included only when published; otherwise the report says they were not stated.", "", "- **Dynamic postings:** job boards change without notice. Re-open the employer application link before applying.", "", "Primary sources: [TraderMath firms](https://www.tradermath.org/practice/firms), [Northwestern 2027 Quant Internships](https://github.com/northwesternfintech/2027QuantInternships), [InternAtlas](https://github.com/sonak11/internatlas), and direct official employer ATS boards.", "");
  return `${lines.join("\n")}\n`;
}

function updateHtml(html, data) {
  const firmsHiring = data.directory.filter((firm) => firm.openRoleCount > 0).length;
  const winterFirms = data.directory.filter((firm) => firm.winterStatus.startsWith("Open")).length;
  const womenLiveApplications = (data.womenPrograms || []).filter((row) => row.status.startsWith("Open")).reduce((count, row) => count + (row.applications?.length || 1), 0);
  const embedded = JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  let output = html
    .replace(/(<div class="as-of"><span>Last successful check<\/span><strong>)[^<]+/, `$1${data.asOf}`)
    .replace(/(checked sources as of )\d{4}-\d{2}-\d{2}/, `$1${data.asOf}`)
    .replace(/(<span class="stat-value">)\d+(<\/span><span class="stat-label">TraderMath firms)/, `$1${data.directory.length}$2`)
    .replace(/(<span class="stat-value">)\d+(<\/span><span class="stat-label">Firms hiring)/, `$1${firmsHiring}$2`)
    .replace(/(<span class="stat-value">)\d+(<\/span><span class="stat-label">Open role links)/, `$1${data.openings.length}$2`)
    .replace(/(<span class="stat-value">)\d+(<\/span><span class="stat-label">Winter firms)/, `$1${winterFirms}$2`)
    .replace(/Women’s programs \(\d+ live applications\)/, `Women’s programs (${womenLiveApplications} live applications)`)
    .replace(/All \d+ firms/, `All ${data.directory.length} firms`)
    .replace(/(Independent research snapshot · Last checked )\d{4}-\d{2}-\d{2}/, `$1${data.asOf}`)
    .replace(/    const DATA = [^\n]*;\n    const state = \{/, `    const DATA = ${embedded};\n    const state = {`);
  if (!output.includes(`const DATA = ${embedded.slice(0, 80)}`)) throw new Error("Could not replace embedded website data.");
  return output;
}

const data = JSON.parse(await fs.readFile(DATA_URL, "utf8"));
const { checks, allRows: officialRows, successes } = await collectOfficialBoards();
console.log(`Official ATS boards checked: ${successes}/${boards.length}`);
const internAtlas = await collectInternAtlas(data);
console.log(`InternAtlas open 2027 quant rows matched: ${internAtlas.rows.length}`);
const boardOpenings = officialRows.map(openingFromBoard).filter(Boolean);
const urlsToCheck = [
  ...data.openings.map((row) => row.applicationUrl),
  ...data.reviewQueue.map((row) => row.applicationUrl),
  ...(data.womenPrograms || []).flatMap((row) => row.applications?.map((item) => item.url) || [row.applicationUrl]),
  ...boardOpenings.map((row) => row.applicationUrl),
  ...internAtlas.rows.map((row) => row.applicationUrl),
];
const linkChecks = await checkUrls(urlsToCheck);
console.log(`Existing application links checked: ${linkChecks.size}`);
const confirmedGoneUrls = [...linkChecks.entries()].filter(([, result]) => result.state === "gone").map(([url]) => url);
const stillLiveOpenings = data.openings.filter((row) => linkChecks.get(row.applicationUrl)?.state !== "gone");
const discoveredOpenings = [...boardOpenings, ...internAtlas.rows].filter((row) => linkChecks.get(row.applicationUrl)?.state !== "gone");
const openings = mergeRows(stillLiveOpenings, discoveredOpenings);
const validCompanies = new Set(data.directory.map((firm) => firm.name));
const invalidCompanies = [...new Set(openings.filter((row) => !validCompanies.has(row.company)).map((row) => row.company))];
if (invalidCompanies.length) throw new Error(`Openings outside TraderMath directory: ${invalidCompanies.join(", ")}`);
const reviewQueue = data.reviewQueue.filter((row) => linkChecks.get(row.applicationUrl)?.state !== "gone").map((row) => ({ ...row, checkedAsOf: AS_OF }));
const womenPrograms = rebuildWomenPrograms(data, officialRows, linkChecks, openings);
const directory = rebuildDirectory(data, openings, reviewQueue);
const output = {
  ...data,
  asOf: AS_OF,
  updateSchedule: UPDATE_SCHEDULE,
  audit: {
    ...data.audit,
    officialAtsBoardsAttempted: boards.length,
    officialAtsBoardsSucceeded: successes,
    officialAtsBoardsFailed: checks.filter((row) => !row.ok).map((row) => ({ company: row.board.company, token: row.board.token, error: row.error })),
    secondaryCurrentTracker: "https://github.com/sonak11/internatlas",
    secondaryTrackerGeneratedAt: internAtlas.generated,
    applicationLinksChecked: linkChecks.size,
    applicationLinksConfirmedGone: confirmedGoneUrls.length,
    applicationLinksRemoved: confirmedGoneUrls,
    wordingPolicy: "No verified opening found is not equivalent to confirmed closed",
  },
  directory,
  openings,
  womenPrograms,
  reviewQueue,
};

const currentHtml = await fs.readFile(HTML_URL, "utf8");
await fs.writeFile(DATA_URL, `${JSON.stringify(output, null, 2)}\n`);
await fs.writeFile(REPORT_URL, buildMarkdown(output));
await fs.writeFile(HTML_URL, updateHtml(currentHtml, output));

console.log(JSON.stringify({
  checkedAsOf: AS_OF,
  officialBoards: `${successes}/${boards.length}`,
  linksChecked: linkChecks.size,
  confirmedGone: confirmedGoneUrls.length,
  firms: directory.length,
  firmsHiring: directory.filter((firm) => firm.openRoleCount > 0).length,
  openings: openings.length,
  womenPrograms: womenPrograms.length,
}, null, 2));
