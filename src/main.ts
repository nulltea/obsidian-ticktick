import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, request } from 'obsidian';
import { getAPI } from "obsidian-dataview";
import {Task} from "obsidian-dataview/lib/data/value";

import {getTickTickAPI, TickTickItem} from "./ticktick"
import {DataArray} from "obsidian-dataview/lib/api/data-array";
import {stat} from "fs";
import ObjectID from "bson-objectid";

// Remember to rename these classes and interfaces!

interface ObsidianTickTickSettings {
	username?: string;
	password?: string;
	token?: string;
}

const DEFAULT_SETTINGS: ObsidianTickTickSettings = { }

export default class ObsidianTickTick extends Plugin {
	settings: ObsidianTickTickSettings;

	async onload() {
		await this.loadSettings();

		const ribbonIconEl = this.addRibbonIcon('checkmark', 'TickTick', (evt: MouseEvent) => {
			let tasks = getAPI(this.app)?.pages("#ticktick").forEach(async page => {
				let tasks = page.file.tasks.values as Task[];

				console.log("file", page.file)
				console.log("tasks", tasks)
				let ticktick = await getTickTickAPI({
					token: this.settings.token,
					auth: {
						username: this.settings.username,
						password: this.settings.password,
					},
					tokenCacher: token => {
						this.settings.token = token;
						return this.saveSettings();
					}
				});

				let items = tasks.map<TickTickItem>((t) => ({
					id: ObjectID(),
					title: t.text,
					status: t.completed,
				}));

				await ticktick.addTask({
					title: page.file.name,
					items: items,
				})
			});
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new ObsidianTickTickSettingTab(this.app, this));
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class ObsidianTickTickSettingTab extends PluginSettingTab {
	plugin: ObsidianTickTick;

	constructor(app: App, plugin: ObsidianTickTick) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();
		containerEl.createEl('h3', {text: 'Sync with TickTick - Settings'});

		new Setting(containerEl)
			.setName('Username')
			.setDesc('...')
			.addText(text => text
				.setPlaceholder('Type username here...')
				.setValue(this.plugin.settings.username)
				.onChange(async (value) => {
					this.plugin.settings.username = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Password')
			.setDesc('...')
			.addText(text => text
				.setPlaceholder('Type password here...')
				.setValue(this.plugin.settings.password)
				.onChange(async (value) => {
					this.plugin.settings.password = value;
					await this.plugin.saveSettings();
				})
			);

	}
}
