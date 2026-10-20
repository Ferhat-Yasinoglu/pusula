# Providers removed at their operator's request (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../reference/REMOVED_PROVIDERS.md) · 🇮🇷 [fa](../../../fa/docs/reference/REMOVED_PROVIDERS.md) · 🇹🇷 [tr](../../../tr/docs/reference/REMOVED_PROVIDERS.md)

---

Einige Dienste wurden in Pusula integriert und später wieder entfernt, weil die Personen, die sie
betreiben, darum gebeten haben. Diese Seite dient als dauerhafte Dokumentation dieser Entfernungen. Ihr einziger Zweck besteht darin,
zu verhindern, dass sie versehentlich wieder hinzugefügt werden: Ein Mitwirkender, der einen alten Fork, ein zwischengespeichertes npm-
Tarball, ein archiviertes Issue oder eine Anfrage wie „Anbieter X wiederherstellen“ findet, benötigt eine zentrale Stelle, die besagt: **nicht
wieder einführen**.

Diese Seite ist **keine** Liste eingestellter oder nicht mehr verfügbarer Dienste. Diese werden in
[`FREE_TIERS.md`](FREE_TIERS.md) („Entfernt / keine kostenlose Stufe“) erfasst und können zurückkehren, wenn auch der Dienst
zurückkehrt. Die nachstehenden Einträge können nur mit schriftlicher Genehmigung des in der Anfrage genannten Betreibers
zurückkehren, und diese Genehmigung muss im Eintrag verlinkt werden.

## Richtlinie

1. **Einer Entfernungsanfrage eines Dienstbetreibers wird entsprochen, nicht darüber verhandelt.** Pusula ist
   mit keinem vorgelagerten Dienst verbunden. Wenn der Betreiber eines Dienstes darum bittet, die
   Integration zu entfernen, wird sie entfernt, unabhängig davon, ob die Integration eine offizielle API verwendet hat oder nicht.
2. **„Entfernt“ bedeutet von jeder Oberfläche, die Pusula kontrolliert.** Executor, Registry-Eintrag, Anbieter-
   ID und Alias, Modellliste, Endpunkte, Umgebungsvariablen, Symbol, Dashboard-Karten, die
   generierte Anbieterreferenz, `FREE_TIERS.md`, die Umgebungsreferenz, Zählwerte in der README,
   `llm.txt`-Spiegelungen, dedizierte Tests und Golden Snapshots, Codekommentare, CHANGELOG-Aufzählungspunkte
   (mit einem protokollierten Abgleich, siehe `config/release/changelog-reconciliations.json`),
   GitHub-Release-Hinweise, das Wiki sowie die GitHub-Issues, -Diskussionen und -Pull-Requests, deren
   Thema dieser Anbieter war (Issues und Diskussionen werden gelöscht; Pull Requests erhalten einen neuen Titel, ihre
   Beschreibung wird ersetzt und der Thread gesperrt, da GitHub Pull Requests nicht löschen kann).
3. **Führen Sie einen Eintrag auf dieser Seite niemals ohne schriftliche Genehmigung wieder ein.** Dazu gehört,
   die ID oder den Alias erneut zu einem Anbieterkatalog hinzuzufügen, die Domains einem Executor hinzuzufügen,
   einen PR eines Mitwirkenden zu akzeptieren, der den Anbieter „wiederherstellt“, ihn dem Katalog kostenloser Modelle hinzuzufügen oder
   eine manuelle Möglichkeit zu dokumentieren, über Pusula auf ihn zuzugreifen. Schließen Sie solche PRs und Issues mit einem
   Link zu dieser Seite.
4. **Halten Sie den Eintrag knapp.** Erfassen Sie nur, was ein Reviewer benötigt, um eine
   Wiedereinführung zu erkennen: Kennungen, Domains, Daten und den Pull Request, mit dem die Entfernung durchgeführt wurde.
   Beschreiben Sie nicht, wie die Integration funktioniert hat.
5. **Der Regressionsschutz ist `tests/unit/removed-providers-blocklist.test.ts`.** Er schlägt fehl, wenn
   eine der nachstehenden Kennungen oder Domains erneut in den Anbieterkatalogen, der Executor-Zuordnung oder
   den Quellen der Anbieter-Registry auftaucht. Fügen Sie die neuen Kennungen im selben PR zu diesem Test hinzu, mit dem
   Sie hier eine Zeile hinzufügen.

## Register

| Entfernt am | Anbieter-ID | Alias | Domains | Angefordert von | Entfernungs-PR | Hinweise  
| 2026-08-12 | `puter` | `pu` | `puter.com` | Puter's owner (Nariman Jelveh) | [#10210](https://github.com/Ferhat-Yasinoglu/pusula/pull/10210) | API-Schlüssel-Anbieter. Migration `152_remove_puter_provider.sql` bereinigt gespeicherte Konfiguration. |
| 2026-09-02 | `theoldllm` | `tllm` | `theoldllm.com`, `theoldllm.vercel.app` | Der Dienstbetreiber (Support-E-Mail) | [#12440](https://github.com/Ferhat-Yasinoglu/pusula/pull/12440) | Schlüsselloser Anbieter. Schriftliche Anfrage erhalten am 30.08.2026. Dedizierte Issues und Diskussion gelöscht, PRs umbenannt. |
| 2026-09-21 | `gemini-business` | `gembiz` | `business.gemini.google` | Entscheidung des Projektinhabers (Issue [#14217](https://github.com/Ferhat-Yasinoglu/pusula/issues/14217)) | [#14467](https://github.com/Ferhat-Yasinoglu/pusula/pull/14467) | Cookie-basierter Web-Anbieter. Google hat den `BardFrontendService/StreamGenerate`-Endpunkt, auf den der Executor abzielte, eingestellt; der Ersatz (`biz-discoveryengine.googleapis.com` `widgetStreamAssist`, Bearer JWT, das von `__Secure-C_SES`/`csesidx` gebootstrappt wird) kann ohne ein aktives Gemini Enterprise/Workspace-Konto, das das Projekt nicht besitzt, nicht erstellt oder validiert werden. Eingestellt statt unbestätigt neu geschrieben. |
| 2026-09-21 | `suno` | `suno` | `studio-api.suno.ai`, `studio-api-prod.suno.com` | Entscheidung des Projektinhabers (`#14224`) | [#14468](https://github.com/Ferhat-Yasinoglu/pusula/pull/14468) | Cookie-Authentifizierungsanbieter, keine Betreiberabschaltung. `studio-api.suno.ai` wurde ausgesetzt (503); der Live-Host erfordert einen Clerk JWT-Austausch plus eine kostenpflichtige hCaptcha-Lösungsabhängigkeit, die Pusula für einen Musik-Anbieter nicht hinzufügen wollte. `kie/suno-v4.0` und `kie/suno-v3.5` (kie.ai-gehostet) sind davon unberührt und werden weiterhin unterstützt. |

## Einen Eintrag hinzufügen

Wenn eine neue Entfernungsanfrage eingeht:

1. Vergewissern Sie sich, dass die Anfrage vom Betreiber des Dienstes stammt (von dessen Supportadresse oder einer
   von ihm kontrollierten Domain), und bewahren Sie die Nachricht vertraulich auf.
2. Entfernen Sie die Integration gemäß der Checkliste in Punkt 2 der Richtlinie. Verwenden Sie
   [#12440](https://github.com/Ferhat-Yasinoglu/pusula/pull/12440) als Referenz für einen
   Anbieter ohne Schlüssel und [#10210](https://github.com/Ferhat-Yasinoglu/pusula/pull/10210) für einen
   API-Schlüssel-Anbieter mit gespeicherten Verbindungen (fügen Sie eine Migration hinzu).
3. Fügen Sie der obigen Tabelle eine Zeile und
   `tests/unit/removed-providers-blocklist.test.ts` die Kennungen hinzu, und zwar im selben PR.
4. Antworten Sie dem Betreiber, sobald der PR zusammengeführt wurde, und führen Sie auf, was entfernt wurde und was Pusula
   nicht ändern kann (bereits veröffentlichte npm- und Docker-Versionen, git-Verlauf, Forks von Drittanbietern).
