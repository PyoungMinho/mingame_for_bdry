#!/bin/bash
# 고정 시각 date — 수집기가 쓰는 %Y %m %d %H %M %S 포맷만 지원한다(CC_FAKE_NOW = YYYY-MM-DDTHH:MM:SSZ). 출력이 결정적이 된다.
fmt=""
for a in "$@"; do case "$a" in +*) fmt=${a#+} ;; esac; done
now=${CC_FAKE_NOW:-2026-10-19T03:12:00Z}
fmt=${fmt//%Y/${now:0:4}}; fmt=${fmt//%m/${now:5:2}}; fmt=${fmt//%d/${now:8:2}}
fmt=${fmt//%H/${now:11:2}}; fmt=${fmt//%M/${now:14:2}}; fmt=${fmt//%S/${now:17:2}}
printf '%s\n' "$fmt"
