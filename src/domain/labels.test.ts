import {describe, expect, it} from "vitest"

import {taskLabel} from "./labels"

describe("taskLabel", () => {
  it("names the task and its direction, with EN for the infinitive next to Russian", () => {
    expect(taskLabel("v1", "ru")).toEqual({name: "Translation", direction: "EN → RU"})
    expect(taskLabel("ru", "v1")).toEqual({name: "Translation", direction: "RU → EN"})
    expect(taskLabel("v1", "v2")).toEqual({name: "Past Simple", direction: "V1 → V2"})
    expect(taskLabel("v1", "v3")).toEqual({name: "Past Participle", direction: "V1 → V3"})
    expect(taskLabel("v3", "v1")).toEqual({name: "Infinitive", direction: "V3 → V1"})
    expect(taskLabel("ru", "v2")).toEqual({name: "Past Simple", direction: "RU → V2"})
  })
})
