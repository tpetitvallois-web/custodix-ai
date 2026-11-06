#!/usr/bin/env node
// Après un déploiement, l'objet durable du registre garde l'ancien code tant qu'il est sollicité.
// Le pont du Mac l'interroge toutes les 3 s : on l'arrête 45 s pour laisser l'objet redémarrer, puis on le relance.
import { execSync } from "node:child_process";
const uid = execSync("id -u").toString().trim();
const plist = `${process.env.HOME}/Library/LaunchAgents/com.custodix.pont.plist`;
const run = (c) => { try { execSync(c, { stdio: "ignore" }); } catch { /* déjà arrêté ou déjà lancé */ } };
run(`launchctl bootout gui/${uid}/com.custodix.pont`);
process.stdout.write("pont du Mac arrêté, 45 s pour laisser le registre redémarrer… ");
await new Promise((r) => setTimeout(r, 45000));
run(`launchctl bootstrap gui/${uid} ${plist}`);
console.log("pont relancé");
