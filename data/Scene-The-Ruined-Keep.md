<style>
    img {
	width: 40%;
	float: left;
	margin-right: 1em;
	margin-bottom: 1em;
	}

    /*
    Read-aloud text is within a block given the read-aloud class.
    If reading certain sections of the text is conditional, it should be formatted as
    as dictionary list.
    */
    .read-aloud > * {
     
        margin-bottom: 1em;
    }

    .read-aloud {
        width: 80%;
        margin: 0 auto;
        font-size: 1.1em;
        font-family: "Georgia";
        background-color: rgba(0, 0, 0, 0.3);
        padding: 1em;
        list-style-type: none;
    }

    h2 {
        display: none;
    }

    /*
    General features about an area are presented as an unordered list given the features class.
    */
    .features {
        list-style-type: none;
        margin: 1em auto 0 auto;
        padding: 1em;
        background-color: rgba(0, 0, 0, 0.3);
    }

    .features > * {
        margin: 0;
        margin-bottom: 1em;
        padding: 0;
    }

    /*
    Information dependent on timing is presented in a definition list.
    */
    .time-dependent {
        margin: 1em auto 0 auto;
        padding: 1em;
        background-color: rgba(0, 0, 0, 0.3);
    }

    .time-dependent > dt {
        font-weight: bold;
    }

    .time-dependent > dd {
        margin-bottom: 1em;
    }

    /*
    How to get in and out:
    */
    .enter-exit {
        
    }
    /* mark (==) is used for read-aloud text

    .read-aloud {
        width: 80%;
        margin: 0 auto;
        font-size: 1.1em;
        font-family: "Georgia";
        background-color: rgba(0, 0, 0, 0.3);
        padding: 1em;
        font-size: 1.1em;
        font-family: "Georgia";
    }

    .read-aloud mark {
        background-color: inherit;
        color: inherit;
    }

    [data-type="Features"] {
        color: blue;
    }

    [data-type="Features"] + * {
        color: blue;
    }

    .what {
        display: none;
    } */
</style>
![](modules/sailors-on-the-starless-sea/assets/handouts/Scene-The-Ruined-Keep.png)
# The Ruined Keep {.scene}

::: read-aloud

You stand before the ruined keep, which squats atop a **low, craggy hill**, its walls of toppled stone and massive granite blocks hinting at forgotten battles and the clash of mighty armies. Now the ruins seem host only to creeping vines and the foul miasma that drifts down from the keep.

The **air is overrun with pestilence**. Fat flies bite at you incessantly, and **clouds of small black insects** choke your every breath. The long-abandoned land is **choked with thorny vines** that drape the **sickly trees** and hang from the **ruined walls**. There is an **odor of rot and decay**, as if the hill itself were decomposing from within.

A sight gives you pause: **a ragged banner, depicting a crimson skull on a black field**, stands high atop the ruined walls. Whatever lurks within has terrorized you and your village for far too long.

You turn to your companions and ready your meager weapons. The time for retribution has come.

:::

## Features {.features}

- The keep’s **walls rise 30 feet from their rammed earth embankments**. See below for climbing details.
- The walls and all the fallen stones are **covered in a patchwork of moss, sickly vines, and lichen**.
- Rather than simple carved blocks, the keep seems to have been **built of enormous standing stones and mighty dolmens**. The blocks are fitted together crudely, leaving **cracks between the stones** for rotting vegetation and pools of water that act as host to the **gnats and mosquitoes**.
{.features}


## Timing {.time-dependent}

By Day {.day}
: The keep betrays no obvious signs of patrols.

At Dusk {.dusk}
: Two beastmen (from above the @JournalEntry[Gatehouse]) light torches on the ruined battlements.
	The glow of the @JournalEntry[Sinkhole] becomes more obvious.
	
At Night {.night}
: Torches and the @JournalEntry[Sinkhole] throw weird shadows. Glimpses of the beastmen above the @JournalEntry[Gatehouse] may be seen.
{.time-dependent}

## Entries and Exits {.enter-exit}

The PCs are free to enter as they see fit.

- While the **most obvious approach takes them up the @JournalEntry[Devil's Causeway]**, this is also the most dangerous. Wily characters will be rewarded for their suspicion, though hesitation should never be mistaken for caution.
- **Approaching from the west** requires the characters to ascend the @JournalEntry[Ruined Wall]. Picking their way through the fallen blocks is not difficult, but carries its own risks.
- **Approaching from northeast** brings the PCs directly to the @JournalEntry[Sinkhole].
- Characters **attempting to ascend walls** face a difficult climb. [^Climb-walls]  {#climb}


[^Climb-walls]: Each character attempting to scale the walls must succeed on a ***DC 15 climb check*** or fall 20 feet ***for 2d6 damage*** before tumbling down to the base of the rammed earth mound. Remember that falls also include a **chance of broken bones**; each ***6*** rolled adds a broken bone and permanent loss of ***1 Strength or Agility*** as described in @Compendium[dcc-core-book.dcc-core-text.MNAG6rNKx8YEo1ry]{Chapter 4: Combat}.