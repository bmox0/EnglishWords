import {createApp} from "vue"

import App from "./App.vue"
import {NOTES} from "./domain/data"
import {createStudy, StudyKey} from "./store/study"

import "./styles.css"

function browserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

createApp(App).provide(StudyKey, createStudy(NOTES, browserStorage())).mount("#app")
