import { request } from 'obsidian';
import ObjectID from "bson-objectid"

export type TickTickArgs = {
	auth: {
		username: string,
		password: string
	},
	tokenCacher: (token: string) => Promise<void>
	token?: string
}

export type TickTickTask = {
	content?: string,
	deleted?: number,
	id?: ObjectID,
	isAllDay?: boolean,
	isDirty?: boolean,
	items?: TickTickItem[],
	local?: boolean,
	modifiedTime?: Date,
	priority?: number,
	progress?: number,
	projectId?: ObjectID,
	title: string,
	sortOrder?: number
}

export type TickTickItem = {
	id?: ObjectID,
	status: boolean,
	title: string,
	sortOrder?: number
}

class TickTick {
	sortOrder: number;
	inboxId: ObjectID;
	token: string;

	constructor() {
		this.sortOrder = 0;
	}

	async login(args: TickTickArgs): Promise<Error> {
		let resp = JSON.parse(await request({
			method: "POST",
			url: 'https://ticktick.com/api/v2/user/signon?wc=true&remember=true',
			headers: {
				'Content-Type': 'application/json',
				'Origin': "https://ticktick.com"
			},
			body: JSON.stringify({
				username: args.auth.username,
				password: args.auth.password
			})
		}));

		if (resp.error != null) {
			return new Error(resp.error);
		}

		await args.tokenCacher(resp.token);
		this.token = resp.token;

		await this.getSortOrder();

		return null
	}

	async getSortOrder() {
		let resp = await request({
			url: 'https://ticktick.com/api/v2/batch/check/0',
			headers: {
				'Content-Type': 'application/json',
				'Origin': "https://ticktick.com",
				'cookie': 't=' + this.token
			},
		});

		let body = JSON.parse(resp);

		this.inboxId = body.inboxId;
		body.syncTaskBean.update.forEach((task: any) => {
			if (task.projectId == this.inboxId && task.sortOrder < this.sortOrder) {
				this.sortOrder = task.sortOrder;
			}
		});
		this.sortOrder--;
	}

	//the default list will be inbox
	async addTask(taskArgs: TickTickTask) {
		let resp = await request({
			method: "POST",
			url: 'https://ticktick.com/api/v2/task',
			headers: {
				'Content-Type': 'application/json',
				'Origin': 'https://ticktick.com',
				'cookie': 't=' + this.token
			},
			body: JSON.stringify({
				//assignee: (taskArgs.assignee) ? taskArgs.assignee : null,
				content: (taskArgs.content) ? taskArgs.content : "",
				deleted: (taskArgs.deleted) ? taskArgs.deleted : 0,
				//dueDate: (taskArgs.dueDate) ? taskArgs.dueDate : null,
				id: (taskArgs.id) ? taskArgs.id : ObjectID(),
				isAllDay: (taskArgs.isAllDay) ? taskArgs.isAllDay : null,
				isDirty: (taskArgs.isDirty) ? taskArgs.isDirty : true,
				items: (taskArgs.items) ? taskArgs.items : [],
				local: (taskArgs.local) ? taskArgs.local : true,
				modifiedTime: (taskArgs.modifiedTime) ? taskArgs.modifiedTime.toISOString().replace("Z", "+0000") : new Date().toISOString().replace("Z", "+0000"), //"2017-08-12T17:04:51.982+0000",
				priority: (taskArgs.priority) ? taskArgs.priority :0,
				progress: (taskArgs.progress) ? taskArgs.progress : 0,
				projectId: (taskArgs.projectId) ? taskArgs.projectId : this.inboxId,
				// reminder: (taskArgs.reminder) ? taskArgs.reminder : null,
				// reminders: (taskArgs.reminders) ? taskArgs.reminders : [{id:ObjectID(),trigger:"TRIGGER:PT0S"}],
				// remindTime: (taskArgs.remindTime) ? taskArgs.remindTime : null,
				// repeatFlag: (taskArgs.repeatFlag) ? taskArgs.repeatFlag : null,
				// sortOrder: (taskArgs.sortOrder) ? taskArgs.sortOrder : this.sortOrder,
				// startDate: (taskArgs.startDate) ? taskArgs.startDate : null,
				// status: (taskArgs.status) ? taskArgs.status : 0,
				// tags: (taskArgs.tags) ? taskArgs.tags : [],
				// timeZone: (taskArgs.timeZone) ? taskArgs.timeZone : "America/New_York", // This needs to be updated to grab dynamically
				title: taskArgs.title,
			})
		})

		console.log(resp);

		let body = JSON.parse(resp);

		console.log("Added: " + taskArgs.title);
		this.sortOrder = body.sortOrder - 1;
	}
}

export async function getTickTickAPI(args: TickTickArgs): Promise<TickTick> {
	const ticktick = new TickTick();

	if (args.token != undefined) {
		ticktick.token = args.token
		await ticktick.getSortOrder();
		return ticktick
	}

	let err = await new TickTick().login(args);
	if (err != null) {
		throw err;
	}

	return ticktick;
}
