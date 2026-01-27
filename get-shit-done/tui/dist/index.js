#!/usr/bin/env node
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// index.tsx
import React5 from "react";
import { render } from "ink";

// App.tsx
import React4, { useState as useState2, useEffect as useEffect2, useMemo } from "react";
import { Box as Box4, Text as Text4 } from "ink";

// components/PhaseCard.tsx
import React from "react";
import { Box, Text } from "ink";
var PhaseCard = ({
  phase,
  phaseName,
  totalPhases,
  currentPhaseIndex,
  stages,
  description,
  progress
}) => {
  const getStageColor = (stage) => {
    var _a;
    if (stage.completed) return "green";
    if (stage.name === ((_a = stages[stages.length - 1]) == null ? void 0 : _a.name)) return "cyan";
    return "gray";
  };
  return /* @__PURE__ */ React.createElement(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", padding: 1 }, /* @__PURE__ */ React.createElement(Box, { justifyContent: "space-between", alignItems: "center" }, /* @__PURE__ */ React.createElement(Text, { bold: true, color: "cyan" }, `PHASE ${phase}`), /* @__PURE__ */ React.createElement(Text, { dimColor: true }, currentPhaseIndex + 1, " / ", totalPhases)), /* @__PURE__ */ React.createElement(Text, { bold: true }, phaseName), !!description && /* @__PURE__ */ React.createElement(Box, { marginTop: 1 }, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, description)), /* @__PURE__ */ React.createElement(Box, { marginTop: 1, flexDirection: "column" }, /* @__PURE__ */ React.createElement(Text, { dimColor: true }, "Progress"), /* @__PURE__ */ React.createElement(Box, null, /* @__PURE__ */ React.createElement(Box, { width: 40 }, /* @__PURE__ */ React.createElement(Text, null, Array.from({ length: 40 }, (_, i) => {
    const fillPercent = i / 40 * 100;
    return /* @__PURE__ */ React.createElement(Text, { key: i, backgroundColor: fillPercent <= progress ? "cyan" : void 0 }, fillPercent <= progress ? "\u2588" : "\u2591");
  }))), /* @__PURE__ */ React.createElement(Text, null, " ", Math.round(progress), "%"))), /* @__PURE__ */ React.createElement(Box, { marginTop: 1, flexDirection: "column" }, /* @__PURE__ */ React.createElement(Text, { bold: true }, "Stages"), stages.map((stage, idx) => /* @__PURE__ */ React.createElement(Box, { key: idx, justifyContent: "space-between" }, /* @__PURE__ */ React.createElement(Text, { color: getStageColor(stage) }, stage.completed ? "\u2713" : "\u25CB", " ", stage.name), /* @__PURE__ */ React.createElement(Text, { dimColor: true }, stage.elapsed || "in progress...")))));
};

// components/ActivityFeed.tsx
import React2, { useEffect, useState } from "react";
import { Box as Box2, Text as Text2 } from "ink";
var ActivityFeed = ({ activities, maxItems = 12 }) => {
  const [dots, setDots] = useState("");
  useEffect(() => {
    const timer = setInterval(() => {
      setDots((prev) => {
        if (prev.length >= 3) return "";
        return prev + ".";
      });
    }, 500);
    return () => clearInterval(timer);
  }, []);
  const displayActivities = activities.slice(-maxItems);
  const getActivityIcon = (type) => {
    switch (type) {
      case "read":
        return "\u{1F4D6}";
      case "write":
        return "\u270D\uFE0F";
      case "edit":
        return "\u{1F4DD}";
      case "commit":
        return "\u2713";
      case "test":
        return "\u{1F9EA}";
      case "stage":
        return "\u2699\uFE0F";
      case "error":
        return "\u26D4";
      case "info":
        return "\u2139\uFE0F";
      default:
        return "\u2022";
    }
  };
  const getActivityColor = (type) => {
    switch (type) {
      case "read":
        return "blue";
      case "write":
        return "green";
      case "edit":
        return "yellow";
      case "commit":
        return "green";
      case "test":
        return "magenta";
      case "stage":
        return "cyan";
      case "error":
        return "red";
      case "info":
        return "gray";
      default:
        return "white";
    }
  };
  const getTypeLabel = (type) => {
    const labels = {
      read: "READ",
      write: "WRITE",
      edit: "EDIT",
      commit: "COMMIT",
      test: "TEST",
      stage: "STAGE",
      error: "ERROR",
      info: "INFO"
    };
    return labels[type] || "ACTIVITY";
  };
  return /* @__PURE__ */ React2.createElement(Box2, { flexDirection: "column", borderStyle: "round", borderColor: "gray", padding: 1, height: 18 }, /* @__PURE__ */ React2.createElement(Box2, { justifyContent: "space-between", alignItems: "center" }, /* @__PURE__ */ React2.createElement(Text2, { bold: true }, "Activity Feed"), /* @__PURE__ */ React2.createElement(Text2, { color: "gray" }, dots)), /* @__PURE__ */ React2.createElement(Box2, { flexDirection: "column", marginTop: 1, overflow: "hidden" }, displayActivities.length === 0 ? /* @__PURE__ */ React2.createElement(Text2, { dimColor: true, italic: true }, "Waiting for activity...") : displayActivities.map((activity, idx) => /* @__PURE__ */ React2.createElement(
    Box2,
    {
      key: idx,
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: idx < displayActivities.length - 1 ? 0 : 0
    },
    /* @__PURE__ */ React2.createElement(Box2, { flexGrow: 1 }, /* @__PURE__ */ React2.createElement(Text2, null, /* @__PURE__ */ React2.createElement(Text2, { dimColor: true }, "[", activity.timestamp.toLocaleTimeString(), "]"), " ", /* @__PURE__ */ React2.createElement(Text2, { color: getActivityColor(activity.type) }, getActivityIcon(activity.type)), " ", /* @__PURE__ */ React2.createElement(Text2, { dimColor: true }, getTypeLabel(activity.type), ":"), " ", activity.detail))
  ))));
};

// components/StatsBar.tsx
import React3 from "react";
import { Box as Box3, Text as Text3 } from "ink";
var StatsBar = ({
  totalPhases,
  completedPhases,
  elapsedTime,
  estimatedTimeRemaining,
  tokens,
  cost,
  budget
}) => {
  const progress = completedPhases / totalPhases * 100;
  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor(seconds % 3600 / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    } else if (mins > 0) {
      return `${mins}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };
  return /* @__PURE__ */ React3.createElement(
    Box3,
    {
      flexDirection: "column",
      borderStyle: "round",
      borderColor: "green",
      padding: 1,
      marginTop: 1
    },
    /* @__PURE__ */ React3.createElement(Box3, { justifyContent: "space-between", alignItems: "center" }, /* @__PURE__ */ React3.createElement(Text3, { bold: true, color: "green" }, "\u{1F4CA} Execution Stats"), /* @__PURE__ */ React3.createElement(Text3, { dimColor: true }, elapsedTime)),
    /* @__PURE__ */ React3.createElement(Box3, { marginTop: 1 }, /* @__PURE__ */ React3.createElement(Box3, { flexGrow: 1, flexDirection: "column", marginRight: 2 }, /* @__PURE__ */ React3.createElement(Text3, { dimColor: true }, "Phases"), /* @__PURE__ */ React3.createElement(Box3, { alignItems: "center" }, /* @__PURE__ */ React3.createElement(Box3, { width: 30 }, /* @__PURE__ */ React3.createElement(Text3, null, Array.from({ length: 30 }, (_, i) => {
      const fillPercent = i / 30 * 100;
      return /* @__PURE__ */ React3.createElement(
        Text3,
        {
          key: i,
          backgroundColor: fillPercent <= progress ? "green" : void 0
        },
        fillPercent <= progress ? "\u2588" : "\u2591"
      );
    }))), /* @__PURE__ */ React3.createElement(Text3, null, " ", completedPhases, "/", totalPhases))), /* @__PURE__ */ React3.createElement(Box3, { flexGrow: 1, flexDirection: "column", marginLeft: 2 }, /* @__PURE__ */ React3.createElement(Text3, { dimColor: true }, "Time"), /* @__PURE__ */ React3.createElement(Text3, { bold: true, color: "cyan" }, elapsedTime, estimatedTimeRemaining && /* @__PURE__ */ React3.createElement(Text3, { dimColor: true }, " (remaining: ", estimatedTimeRemaining, ")")))),
    /* @__PURE__ */ React3.createElement(Box3, { marginTop: 1, justifyContent: "space-between" }, /* @__PURE__ */ React3.createElement(Box3, null, /* @__PURE__ */ React3.createElement(Text3, { dimColor: true }, "Tokens: "), /* @__PURE__ */ React3.createElement(Text3, { bold: true }, tokens.toLocaleString())), /* @__PURE__ */ React3.createElement(Box3, null, /* @__PURE__ */ React3.createElement(Text3, { dimColor: true }, "Cost: "), /* @__PURE__ */ React3.createElement(Text3, { bold: true, color: "green" }, "$", cost)), budget && /* @__PURE__ */ React3.createElement(Box3, null, /* @__PURE__ */ React3.createElement(Text3, { dimColor: true }, "Budget: "), /* @__PURE__ */ React3.createElement(
      Text3,
      {
        bold: true,
        color: budget.used / budget.limit > 0.8 ? "red" : budget.used / budget.limit > 0.6 ? "yellow" : "green"
      },
      "$",
      budget.used.toFixed(2),
      " / $",
      budget.limit
    ))),
    budget && /* @__PURE__ */ React3.createElement(Box3, { marginTop: 1 }, /* @__PURE__ */ React3.createElement(Text3, { dimColor: true }, "Budget Usage: "), /* @__PURE__ */ React3.createElement(Box3, { width: 40 }, /* @__PURE__ */ React3.createElement(Text3, null, Array.from({ length: 40 }, (_, i) => {
      const fillPercent = i / 40 * (budget.used / budget.limit) * 100;
      const color = budget.used / budget.limit > 0.8 ? "red" : budget.used / budget.limit > 0.6 ? "yellow" : "green";
      return /* @__PURE__ */ React3.createElement(Text3, { key: i, backgroundColor: color }, fillPercent <= 100 ? "\u2588" : "\u2591");
    }))), /* @__PURE__ */ React3.createElement(Text3, null, " ", Math.round(budget.used / budget.limit * 100), "%"))
  );
};

// utils/pipeReader.ts
import { createInterface } from "readline";
var ActivityPipeReader = class {
  pipePath;
  listeners = [];
  constructor(pipePath) {
    this.pipePath = pipePath;
  }
  onMessage(listener) {
    this.listeners.push(listener);
  }
  start() {
    const rl = createInterface({
      input: __require("fs").createReadStream(this.pipePath),
      crlfDelay: Infinity
    });
    rl.on("line", (line) => {
      if (!line.trim()) return;
      try {
        const msg = this.parseMessage(line);
        if (msg) {
          this.listeners.forEach((listener) => listener(msg));
        }
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    });
    rl.on("error", (err) => {
      if (err.code !== "ENOENT") {
        console.error("Pipe reader error:", err);
      }
    });
  }
  parseMessage(line) {
    const parts = line.split(":");
    if (parts.length < 2) return null;
    const prefix = parts[0];
    switch (prefix) {
      case "STAGE": {
        const type = parts[1];
        const detail = parts.slice(2).join(":");
        return {
          type: "stage",
          stage: type,
          detail,
          timestamp: /* @__PURE__ */ new Date()
        };
      }
      case "FILE": {
        const op = parts[1];
        const file = parts.slice(2).join(":");
        return {
          type: "file",
          detail: `${op}: ${file}`,
          timestamp: /* @__PURE__ */ new Date()
        };
      }
      case "COMMIT": {
        const message = parts.slice(1).join(":");
        return {
          type: "commit",
          detail: message,
          timestamp: /* @__PURE__ */ new Date()
        };
      }
      case "TEST": {
        return {
          type: "test",
          detail: "Running tests",
          timestamp: /* @__PURE__ */ new Date()
        };
      }
      case "INFO": {
        const message = parts.slice(1).join(":");
        return {
          type: "info",
          detail: message,
          timestamp: /* @__PURE__ */ new Date()
        };
      }
      case "ERROR": {
        const message = parts.slice(1).join(":");
        return {
          type: "error",
          detail: message,
          timestamp: /* @__PURE__ */ new Date()
        };
      }
      default:
        return null;
    }
  }
};

// App.tsx
var App = () => {
  const [activities, setActivities] = useState2([]);
  const [currentStage, setCurrentStage] = useState2(null);
  const [completedStages, setCompletedStages] = useState2([]);
  const [currentPhase, setCurrentPhase] = useState2("1");
  const [phaseName, setPhaseName] = useState2("Initializing...");
  const [totalPhases] = useState2(3);
  const [completedPhases, setCompletedPhases] = useState2(0);
  const [startTime] = useState2(/* @__PURE__ */ new Date());
  const [tokens, setTokens] = useState2(0);
  const [cost, setCost] = useState2("0.00");
  const [budget] = useState2(void 0);
  useEffect2(() => {
    const pipePath = process.env.GSD_ACTIVITY_PIPE || ".planning/logs/activity.pipe";
    const reader = new ActivityPipeReader(pipePath);
    reader.onMessage((msg) => {
      setActivities((prev) => [...prev, msg]);
      if (msg.type === "stage") {
        const [stageType, ...descParts] = msg.detail.split(":");
        const description = descParts.join(":");
        if (currentStage && currentStage.stage !== stageType) {
          setCompletedStages((prev) => [
            ...prev,
            { name: currentStage.stage, elapsed: currentStage.elapsed }
          ]);
        }
        setCurrentStage({
          stage: stageType,
          stageDesc: description,
          elapsed: "0:00"
        });
      }
      if (msg.type === "file") {
      }
      if (msg.type === "commit") {
      }
    });
    reader.start();
    return () => {
    };
  }, []);
  const elapsedTime = useMemo(() => {
    const diff = Math.floor((Date.now() - startTime.getTime()) / 1e3);
    const hrs = Math.floor(diff / 3600);
    const mins = Math.floor(diff % 3600 / 60);
    const secs = diff % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    } else if (mins > 0) {
      return `${mins}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }, [startTime]);
  const stages = useMemo(() => {
    const stages2 = [
      ...completedStages.map((s) => ({ ...s, completed: true }))
    ];
    if (currentStage) {
      stages2.push({
        name: currentStage.stage,
        elapsed: currentStage.elapsed,
        completed: false
      });
    }
    return stages2;
  }, [completedStages, currentStage]);
  const progress = useMemo(() => {
    if (stages.length === 0) return 0;
    const completed = stages.filter((s) => s.completed).length;
    return completed / (stages.length + 3) * 100;
  }, [stages]);
  return /* @__PURE__ */ React4.createElement(Box4, { flexDirection: "column", padding: 1 }, /* @__PURE__ */ React4.createElement(Box4, { justifyContent: "center", marginBottom: 1 }, /* @__PURE__ */ React4.createElement(Text4, { bold: true, color: "cyan" }, "\u2554\u2550\u2550\u2550\u2557 \u2554\u2557   \u2554\u2557      \u2554\u2550\u2550\u2557 \u2551\u2554\u2550\u2550\u255D \u2551\u2551   \u2551\u2551      \u2551\u2554\u2557\u2551 \u2551\u255A\u2550\u2550\u2557 \u2551\u2551   \u2551\u2551      \u2551\u255A\u255D\u2551 \u2551\u2554\u2550\u2550\u255D \u2551\u2551   \u2551\u2551      \u2551\u2554\u2557\u2551 \u2551\u255A\u2550\u2550\u2557 \u2551\u255A\u2550\u2550\u2557\u2551\u255A\u2550\u2550\u2557   \u2551\u255A\u255D\u2551 \u255A\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u255D\u255A\u2550\u2550\u2550\u255D   \u255A\u2550\u2550\u255D")), /* @__PURE__ */ React4.createElement(Text4, { bold: true, color: "cyan" }, "GET SHIT DONE - AUTOPILOT"), /* @__PURE__ */ React4.createElement(Box4, { marginY: 1 }, /* @__PURE__ */ React4.createElement(Text4, { dimColor: true }, "\u2500".repeat(60))), /* @__PURE__ */ React4.createElement(Box4, { flexDirection: "row", gap: 1, flexGrow: 1 }, /* @__PURE__ */ React4.createElement(Box4, { flexDirection: "column", flexGrow: 1 }, /* @__PURE__ */ React4.createElement(
    PhaseCard,
    {
      phase: currentPhase,
      phaseName,
      totalPhases,
      currentPhaseIndex: completedPhases,
      stages,
      description: currentStage == null ? void 0 : currentStage.stageDesc,
      progress
    }
  )), /* @__PURE__ */ React4.createElement(Box4, { flexDirection: "column", flexGrow: 1 }, /* @__PURE__ */ React4.createElement(ActivityFeed, { activities }))), /* @__PURE__ */ React4.createElement(
    StatsBar,
    {
      totalPhases,
      completedPhases,
      elapsedTime,
      tokens,
      cost,
      budget
    }
  ));
};
var App_default = App;

// index.tsx
var { waitUntilExit } = render(/* @__PURE__ */ React5.createElement(App_default, null));
waitUntilExit().then(() => {
  console.log("TUI closed");
  process.exit(0);
});
