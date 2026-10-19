"use client";

import type {
	PagePresenceViewer,
	PresenceVisitor,
} from "@superset/shared/page-presence";
import {
	openPagePresence,
	type PagePresenceClient,
} from "@superset/shared/page-presence-client";
import { useCallback, useSyncExternalStore } from "react";

interface Room {
	client: PagePresenceClient;
	viewers: PagePresenceViewer[];
	visitors: PresenceVisitor[];
	holders: number;
}

const NONE: PagePresenceViewer[] = [];
const NO_VISITORS: PresenceVisitor[] = [];
const rooms = new Map<string, Room>();
const listeners = new Set<() => void>();

const notify = () => {
	for (const listener of listeners) listener();
};

export function joinPagePresence(
	pageId: string,
	url: () => Promise<string | null>,
): () => void {
	let room = rooms.get(pageId);
	if (!room) {
		const created = {
			viewers: NONE,
			visitors: NO_VISITORS,
			holders: 0,
		} as Room;
		created.client = openPagePresence({
			url,
			onViewers: (viewers) => {
				created.viewers = viewers;
				notify();
			},
			onVisitors: (visitors) => {
				created.visitors = visitors;
				notify();
			},
		});
		rooms.set(pageId, created);
		room = created;
	}
	const joined = room;
	joined.holders += 1;
	return () => {
		joined.holders -= 1;
		if (joined.holders > 0) return;
		joined.client.stop();
		rooms.delete(pageId);
		notify();
	};
}

export function wakePagePresence() {
	for (const room of rooms.values()) room.client.wake();
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function usePageViewers(
	pageId: string | undefined,
): PagePresenceViewer[] {
	const read = useCallback(
		() => (pageId ? (rooms.get(pageId)?.viewers ?? NONE) : NONE),
		[pageId],
	);
	return useSyncExternalStore(subscribe, read, () => NONE);
}

export function usePresenceVisitors(
	roomId: string | undefined,
): PresenceVisitor[] {
	const read = useCallback(
		() => (roomId ? (rooms.get(roomId)?.visitors ?? NO_VISITORS) : NO_VISITORS),
		[roomId],
	);
	return useSyncExternalStore(subscribe, read, () => NO_VISITORS);
}
