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
	id?: string,
	isAllDay?: boolean,
	isDirty?: boolean,
	items?: TickTickItem[],
	local?: boolean,
	createdTime?: Date,
	modifiedTime?: Date,
	priority?: number,
	progress?: number,
	projectId?: string,
	title: string,
	sortOrder?: number,
	timeZone?: string,
	status: boolean
}

export type TickTickItem = {
	id?: string,
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
	async addTasks(tasksArgs: TickTickTask[]): Promise<[string, string][]> {
		let res = new Set<[string, string]>();
		let toAdd = new Set()

		for (let task of tasksArgs) {
			let items = new Set();
			for (let item of task.items) {
				items.add({
					id: ObjectID().toHexString(),
					title: item.title,
					status: (item.status) ? 1 : 0,
				})
			}

			toAdd.add({
				assignee: null,
				content: (task.content) ? task.content : "",
				createdTime: (task.createdTime) ? task.createdTime.toISOString().replace("Z", "+0000") : new Date().toISOString().replace("Z", "+0000"),
				kind: null,
				dueDate: null,
				// dueDate: (task.dueDate) ? task.dueDate : null,
				items: [...items],
				exDate: [],
				id: (task.id) ? task.id : ObjectID().toHexString(),
				isFloating: false,
				modifiedTime: (task.modifiedTime) ? task.modifiedTime.toISOString().replace("Z", "+0000") : new Date().toISOString().replace("Z", "+0000"), //"2017-08-12T17:04:51.982+0000",
				priority: (task.priority) ? task.priority : 0,
				progress: (task.progress) ? task.progress : 0,
				projectId: (task.projectId) ? task.projectId : this.inboxId,
				reminders: [],
				// reminder: (task.reminder) ? task.reminder : null,
				// reminders: (task.reminders) ? task.reminders : [{id:ObjectID(),trigger:"TRIGGER:PT0S"}],
				// remindTime: (task.remindTime) ? task.remindTime : null,
				// repeatFlag: (task.repeatFlag) ? task.repeatFlag : null,
				sortOrder: (task.sortOrder) ? task.sortOrder : this.sortOrder,
				startDate: null,
				// startDate: (task.startDate) ? task.startDate : null,
				status: (task.status) ? task.status : 0,
				// tags: (task.tags) ? task.tags : [],
				tags: [],
				timeZone: (task.timeZone) ? task.timeZone : "Europe/Kiev", // This needs to be updated to grab dynamically
				title: task.title,
			})
			res.add([task.title, task.id])
		}

		let req: any = {
			add: [...toAdd],
			addAttachments: [],
			delete: [],
			deleteAttachments: [],
			update: [],
			updateAttachments: [],
		};

		console.log(req)

		let resp = await request({
			method: "POST",
			url: 'https://api.ticktick.com/api/v2/batch/task',
			headers: {
				'Content-Type': 'application/json',
				'Origin': 'https://ticktick.com',
				'cookie': 't=' + this.token
			},
			body: JSON.stringify(req)
		})

		console.log(resp);

		let body = JSON.parse(resp);

		this.sortOrder = body.sortOrder - 1;

		return [...res];
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
